import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  CATEGORIES,
  CURRENCIES,
  MAX_FILE_PRICE,
  PLATFORM_FEE_RATE,
  formatBytes,
  formatPrice,
  type Currency,
  type PricingType,
  type RepoFile,
  type ReviewRating,
} from '@sciehub/shared';
import { config } from '../config.js';
import { requireAuth } from '../auth.js';
import {
  addFileToRepo,
  canUserReviewRepo,
  createOrder,
  createRepo,
  createRepoComment,
  createReview,
  deleteRepo,
  deleteReview,
  getOrderById,
  getRepoById,
  getRepoFileById,
  groupRole,
  hasUserPurchasedRepo,
  incrementFileDownload,
  listFreeRepos,
  listRepoComments,
  listRepoFiles,
  listRepoReviews,
  listRepos,
  payOrderWithWallet,
  shareRepoToGroup,
  toggleFavoriteRepo,
  unshareRepoFromGroup,
  updateRepo,
  updateReview,
  inferFileType,
} from '../db.js';

function validatePricing(body: {
  pricingType?: PricingType;
  price?: number;
  currency?: Currency;
}): { ok: true } | { ok: false; error: string } {
  const pricingType = body.pricingType ?? 'free';
  if (pricingType !== 'free' && pricingType !== 'paid') {
    return { ok: false, error: 'pricingType must be "free" or "paid"' };
  }
  if (pricingType === 'paid') {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0 || price > MAX_FILE_PRICE) {
      return { ok: false, error: `price must be > 0 and <= ${MAX_FILE_PRICE}` };
    }
    const currency = body.currency ?? 'CNY';
    if (!CURRENCIES.some((c) => c.code === currency)) {
      return { ok: false, error: 'Unsupported currency' };
    }
  }
  return { ok: true };
}

export async function registerRepoRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/repos', async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const offset = Math.max(Number(q.offset) || 0, 0);
    const minPrice = q.minPrice !== undefined ? Number(q.minPrice) : undefined;
    const maxPrice = q.maxPrice !== undefined ? Number(q.maxPrice) : undefined;
    return listRepos(
      {
        search: q.search,
        category: q.category,
        sort:
          (q.sort as 'recent' | 'popular' | 'views' | 'sales' | 'rating' | 'price_asc' | 'price_desc') ??
          'recent',
        ownerId: q.ownerId,
        groupId: q.groupId,
        pricingType:
          q.pricingType === 'free' || q.pricingType === 'paid' ? q.pricingType : undefined,
        minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
        maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
        limit,
        offset,
      },
      req.authUser?.id ?? null,
    );
  });

  app.get('/api/repos/free', async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    return { items: listFreeRepos(limit, req.authUser?.id ?? null) };
  });

  app.get('/api/repos/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, req.authUser?.id ?? null, true);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    const allFiles = listRepoFiles(id);
    const isOwner = repo.ownerId === req.authUser?.id;
    const isPurchased = req.authUser
      ? hasUserPurchasedRepo(req.authUser.id, id)
      : false;
    const canAccessAll = isOwner || isPurchased || repo.pricingType === 'free';
    const files = canAccessAll
      ? allFiles
      : allFiles.filter((f) => f.isPreview);
    const related = listRepos(
      { category: repo.categoryId, limit: 5, offset: 0 },
      req.authUser?.id ?? null,
    ).items.filter((r) => r.id !== id);
    const reviews = listRepoReviews(id);
    return {
      repo: { ...repo, isPurchased: isPurchased || undefined },
      files,
      related,
      reviews,
      purchaseState: {
        isOwner,
        isPurchased,
        canReview: req.authUser ? canUserReviewRepo(req.authUser.id, id) : false,
      },
    };
  });

  app.post('/api/repos', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const body = (req.body ?? {}) as {
      name?: string;
      description?: string;
      categoryId?: string;
      tags?: string;
      pricingType?: PricingType;
      price?: number;
      currency?: Currency;
      previewImageUrl?: string;
    };
    const name = body.name?.trim() ?? '';
    if (name.length < 2 || name.length > 80) {
      return reply.code(400).send({ error: 'Repository name must be 2–80 characters' });
    }
    if (!body.categoryId || !CATEGORIES.some((c) => c.id === body.categoryId)) {
      return reply.code(400).send({ error: 'Please choose a valid category' });
    }
    const pv = validatePricing(body);
    if (!pv.ok) return reply.code(400).send({ error: pv.error });
    const tags = (body.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);
    const repo = createRepo({
      name,
      description: body.description?.trim() ?? '',
      categoryId: body.categoryId,
      tags,
      ownerId: authUser.id,
      pricingType: body.pricingType ?? 'free',
      price: body.pricingType === 'paid' ? Number(body.price) : 0,
      currency: (body.currency ?? 'CNY') as Currency,
      previewImageUrl: body.previewImageUrl?.trim() || undefined,
    });
    return reply.code(201).send({ repo });
  });

  app.patch('/api/repos/:id', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (repo.ownerId !== authUser.id) {
      return reply.code(403).send({ error: 'Only the owner can edit this repository' });
    }
    const body = (req.body ?? {}) as {
      name?: string;
      description?: string;
      categoryId?: string;
      tags?: string;
      pricingType?: PricingType;
      price?: number;
      currency?: Currency;
      previewImageUrl?: string | null;
    };
    if (typeof body.name === 'string' && (body.name.trim().length < 2 || body.name.trim().length > 80)) {
      return reply.code(400).send({ error: 'Repository name must be 2–80 characters' });
    }
    if (body.categoryId && !CATEGORIES.some((c) => c.id === body.categoryId)) {
      return reply.code(400).send({ error: 'Please choose a valid category' });
    }
    const patchPricing: { pricingType?: PricingType; price?: number; currency?: Currency } = {};
    if (body.pricingType !== undefined) {
      const pv = validatePricing({
        pricingType: body.pricingType,
        price: body.price,
        currency: body.currency,
      });
      if (!pv.ok) return reply.code(400).send({ error: pv.error });
      patchPricing.pricingType = body.pricingType;
      patchPricing.price = body.pricingType === 'paid' ? Number(body.price) : 0;
      patchPricing.currency = (body.currency ?? 'CNY') as Currency;
    }
    const tags =
      typeof body.tags === 'string'
        ? body.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8)
        : undefined;
    const updated = updateRepo(id, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      description: typeof body.description === 'string' ? body.description.trim() : undefined,
      categoryId: body.categoryId,
      tags,
      ...patchPricing,
      previewImageUrl:
        body.previewImageUrl !== undefined
          ? body.previewImageUrl === null
            ? null
            : body.previewImageUrl.trim() || undefined
          : undefined,
    });
    return { repo: updated };
  });

  app.delete('/api/repos/:id', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (repo.ownerId !== authUser.id) {
      return reply.code(403).send({ error: 'Only the owner can delete this repository' });
    }
    deleteRepo(id);
    return { ok: true };
  });

  // ---- Purchase / Checkout -----------------------------------------------

  app.post('/api/repos/:id/checkout', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (repo.ownerId === authUser.id) {
      return reply.code(400).send({ error: 'You cannot purchase your own repository' });
    }
    if (repo.pricingType === 'free') {
      return reply.code(400).send({ error: 'This repository is free — no checkout required' });
    }
    if (hasUserPurchasedRepo(authUser.id, id)) {
      return reply.code(400).send({ error: 'You have already purchased this repository' });
    }
    const platformFee = repo.price * PLATFORM_FEE_RATE;
    const order = createOrder({
      buyerId: authUser.id,
      sellerId: repo.ownerId,
      repoId: id,
      repoName: repo.name,
      repoOwnerId: repo.ownerId,
      quantity: 1,
      unitPrice: repo.price,
      currency: repo.currency,
      platformFee,
      sellerEarning: repo.price - platformFee,
    });
    return reply.code(201).send({
      order,
      formattedTotal: formatPrice(order.totalAmount, order.currency),
      platformFeeRate: PLATFORM_FEE_RATE,
    });
  });

  app.post('/api/repos/:id/purchase-state', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    const isPurchased = hasUserPurchasedRepo(authUser.id, id);
    return {
      isOwner: repo.ownerId === authUser.id,
      isPurchased,
      canReview: canUserReviewRepo(authUser.id, id),
    };
  });

  // ---- Files -------------------------------------------------------------

  app.post('/api/repos/:id/files', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (repo.ownerId !== authUser.id) {
      return reply.code(403).send({ error: 'Only the owner can add files' });
    }

    const files: Array<{ buffer: Buffer; filename: string }> = [];
    const fields: Record<string, string> = {};
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        files.push({ buffer: await part.toBuffer(), filename: part.filename ?? 'file' });
      } else {
        fields[part.fieldname] = String(part.value ?? '');
      }
    }
    const description = (fields.description ?? '').trim();
    const isPreview = fields.isPreview === '1' || fields.isPreview?.toLowerCase() === 'true';
    if (files.length === 0) return reply.code(400).send({ error: 'Attach at least one file' });

    const created: RepoFile[] = [];
    for (const file of files) {
      const storedName = `${randomUUID()}${path.extname(file.filename)}`;
      await fs.promises.writeFile(path.join(config.uploadDir, storedName), file.buffer);
      created.push(
        addFileToRepo({
          repoId: id,
          title: file.filename,
          description,
          fileType: inferFileType(file.filename),
          fileSize: formatBytes(file.buffer.length),
          fileBytes: file.buffer.length,
          filePath: `/uploads/${storedName}`,
          isPreview,
        }),
      );
    }
    return reply.code(201).send({ files: created, repo: getRepoById(id, authUser.id, false) });
  });

  app.get('/api/files/:id/download', async (req, reply) => {
    const { id } = req.params as { id: string };
    const file = getRepoFileById(id);
    if (!file) return reply.code(404).send({ error: 'File not found' });
    const repo = getRepoById(file.repoId, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });

    const isOwner = req.authUser?.id === repo.ownerId;
    const isPurchased = req.authUser ? hasUserPurchasedRepo(req.authUser.id, repo.id) : false;
    const isFree = repo.pricingType === 'free';
    const canDownload = isOwner || isPurchased || isFree || file.isPreview;

    if (!canDownload) {
      return reply
        .code(403)
        .send({ error: 'Purchase required to download this file', requiresPurchase: true });
    }

    const filePath = path.join(config.uploadDir, path.basename(file.filePath));
    if (!fs.existsSync(filePath)) return reply.code(404).send({ error: 'File is missing on the server' });
    incrementFileDownload(id);
    const safeTitle = file.title.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_');
    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${safeTitle}"`)
      .send(fs.createReadStream(filePath));
  });

  // ---- Comments ----------------------------------------------------------

  app.get('/api/repos/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    return { items: listRepoComments(id) };
  });

  app.post('/api/repos/:id/comments', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    const content = ((req.body as { content?: string } | undefined)?.content ?? '').trim();
    if (!content) return reply.code(400).send({ error: 'Comment cannot be empty' });
    if (content.length > 2000) return reply.code(400).send({ error: 'Comment is too long' });
    const comment = createRepoComment(id, authUser.id, content);
    return reply.code(201).send({ comment });
  });

  // ---- Reviews -----------------------------------------------------------

  app.get('/api/repos/:id/reviews', async (req, reply) => {
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    return { items: listRepoReviews(id) };
  });

  app.post('/api/repos/:id/reviews', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (!canUserReviewRepo(authUser.id, id)) {
      return reply.code(403).send({
        error: 'You must purchase (or be the owner of a free repository) before reviewing',
      });
    }
    const body = (req.body ?? {}) as { rating?: number; title?: string; content?: string };
    const rating = Number(body.rating) as ReviewRating;
    if (![1, 2, 3, 4, 5].includes(rating)) {
      return reply.code(400).send({ error: 'rating must be 1–5' });
    }
    const title = (body.title ?? '').trim().slice(0, 120);
    const content = (body.content ?? '').trim().slice(0, 2000);
    const review = createReview({
      userId: authUser.id,
      repoId: id,
      rating,
      title,
      content,
    });
    return reply.code(201).send({ review });
  });

  app.patch('/api/repos/:id/reviews/:reviewId', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { reviewId } = req.params as { reviewId: string };
    const body = (req.body ?? {}) as { rating?: number; title?: string; content?: string };
    const rating = body.rating !== undefined ? (Number(body.rating) as ReviewRating) : undefined;
    if (rating !== undefined && ![1, 2, 3, 4, 5].includes(rating)) {
      return reply.code(400).send({ error: 'rating must be 1–5' });
    }
    const review = updateReview(reviewId, {
      rating,
      title: body.title !== undefined ? body.title.trim().slice(0, 120) : undefined,
      content: body.content !== undefined ? body.content.trim().slice(0, 2000) : undefined,
    });
    if (!review) return reply.code(404).send({ error: 'Review not found' });
    if (review.userId !== authUser.id) {
      return reply.code(403).send({ error: 'Only the author can edit this review' });
    }
    return { review };
  });

  app.delete('/api/repos/:id/reviews/:reviewId', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { reviewId } = req.params as { reviewId: string };
    const body = { id: reviewId };
    const _ = body;
    deleteReview(reviewId);
    return { ok: true };
  });

  // ---- Favorites ---------------------------------------------------------

  app.post('/api/repos/:id/favorite', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    const favorited = toggleFavoriteRepo(id, authUser.id);
    return { favorited, repo: getRepoById(id, authUser.id, false) };
  });

  app.delete('/api/repos/:id/favorite', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    toggleFavoriteRepo(id, authUser.id);
    return { favorited: false, repo: getRepoById(id, authUser.id, false) };
  });

  // ---- Sharing into groups ----------------------------------------------

  app.post('/api/repos/:id/groups', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { groupId?: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (repo.ownerId !== authUser.id) {
      return reply.code(403).send({ error: 'Only the owner can share this repository' });
    }
    if (!body.groupId) return reply.code(400).send({ error: 'groupId is required' });
    if (!groupRole(body.groupId, authUser.id)) {
      return reply.code(400).send({ error: 'Join the group before sharing a repository to it' });
    }
    shareRepoToGroup(id, body.groupId);
    return { repo: getRepoById(id, authUser.id, false) };
  });

  app.delete('/api/repos/:id/groups/:groupId', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { id, groupId } = req.params as { id: string; groupId: string };
    const repo = getRepoById(id, null, false);
    if (!repo) return reply.code(404).send({ error: 'Repository not found' });
    if (repo.ownerId !== authUser.id) {
      return reply.code(403).send({ error: 'Only the owner can unshare this repository' });
    }
    unshareRepoFromGroup(id, groupId);
    return { repo: getRepoById(id, authUser.id, false) };
  });

  // ---- Pay order directly (convenience endpoint under repo) -------------

  app.post('/api/orders/:orderId/pay', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return;
    const { orderId } = req.params as { orderId: string };
    const order = getOrderById(orderId);
    if (!order) return reply.code(404).send({ error: 'Order not found' });
    if (order.buyerId !== authUser.id) {
      return reply.code(403).send({ error: 'Only the buyer can pay this order' });
    }
    if (order.status !== 'pending') {
      return reply.code(400).send({ error: `Order is already ${order.status}` });
    }
    const result = payOrderWithWallet(orderId, authUser.id);
    if (!result.success) {
      return reply.code(400).send({ error: result.error, code: result.code });
    }
    return reply.code(200).send({
      order: result.order,
      purchase: result.purchase,
      formattedTotal: result.order ? formatPrice(result.order.totalAmount, result.order.currency) : undefined,
    });
  });
}
