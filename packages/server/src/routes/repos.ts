import type { Hono } from 'hono';
import {
  CATEGORIES,
  CURRENCIES,
  LEVELS,
  MAX_FILE_PRICE,
  PLATFORM_FEE_RATE,
  RESOURCE_TYPES,
  formatBytes,
  formatPrice,
  type Currency,
  type EducationLevel,
  type PricingType,
  type ResourceType,
  type ReviewRating,
} from '@sciehub/shared';
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
  getReviewById,
  groupRole,
  hasUserPurchasedRepo,
  incrementFileDownload,
  inferFileType,
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
} from '../db.js';
import { uploadKey, putUpload, getUpload, deleteUpload } from '../storage.js';
import { getConfig } from '../runtime.js';
import { readJson } from '../http.js';
import type { AppEnv } from '../types.js';

function validateClassification(body: {
  levelId?: string;
  resourceType?: string;
}): { ok: true; levelId: EducationLevel; resourceType: ResourceType } | { ok: false; error: string } {
  const levelId = body.levelId ?? '';
  if (!LEVELS.some((level) => level.id === levelId)) {
    return { ok: false, error: 'Please choose a valid level (IG, AS, A Level, IB or AP)' };
  }
  const resourceType = body.resourceType ?? '';
  if (!RESOURCE_TYPES.some((type) => type.id === resourceType)) {
    return { ok: false, error: 'Please choose a valid resource type' };
  }
  return { ok: true, levelId: levelId as EducationLevel, resourceType: resourceType as ResourceType };
}

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
    if (!CURRENCIES.some((item) => item.code === currency)) {
      return { ok: false, error: 'Unsupported currency' };
    }
  }
  return { ok: true };
}

export function registerRepoRoutes(app: Hono<AppEnv>): void {
  app.get('/api/repos', async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
    const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
    const minPriceRaw = c.req.query('minPrice');
    const maxPriceRaw = c.req.query('maxPrice');
    const minPrice = minPriceRaw !== undefined ? Number(minPriceRaw) : undefined;
    const maxPrice = maxPriceRaw !== undefined ? Number(maxPriceRaw) : undefined;
    return c.json(
      await listRepos(
        {
          search: c.req.query('search'),
          category: c.req.query('category'),
          level: c.req.query('level'),
          resourceType: c.req.query('resourceType'),
          sort:
            (c.req.query('sort') as
              | 'recent'
              | 'popular'
              | 'views'
              | 'sales'
              | 'rating'
              | 'price_asc'
              | 'price_desc') ?? 'recent',
          ownerId: c.req.query('ownerId'),
          groupId: c.req.query('groupId'),
          pricingType:
            c.req.query('pricingType') === 'free' || c.req.query('pricingType') === 'paid'
              ? (c.req.query('pricingType') as 'free' | 'paid')
              : undefined,
          minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
          maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
          limit,
          offset,
        },
        c.get('authUser')?.id ?? null,
      ),
    );
  });

  app.get('/api/repos/free', async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
    return c.json({ items: await listFreeRepos(limit, c.get('authUser')?.id ?? null) });
  });

  app.get('/api/repos/:id', async (c) => {
    const { id } = c.req.param();
    const authUser = c.get('authUser');
    const repo = await getRepoById(id, authUser?.id ?? null, true);
    if (!repo) return c.json({ error: 'Repository not found' }, 404);
    const allFiles = await listRepoFiles(id);
    const isOwner = repo.ownerId === authUser?.id;
    const isPurchased = authUser ? await hasUserPurchasedRepo(authUser.id, id) : false;
    const canAccessAll = isOwner || isPurchased || repo.pricingType === 'free';
    const files = canAccessAll ? allFiles : allFiles.filter((file) => file.isPreview);
    const related = (
      await listRepos({ category: repo.categoryId, limit: 5, offset: 0 }, authUser?.id ?? null)
    ).items.filter((item) => item.id !== id);
    return c.json({
      repo: { ...repo, isPurchased: isPurchased || undefined },
      files,
      related,
      reviews: await listRepoReviews(id),
      purchaseState: {
        isOwner,
        isPurchased,
        canReview: authUser ? await canUserReviewRepo(authUser.id, id) : false,
      },
    });
  });

  app.post('/api/repos', async (c) => {
    const authUser = await requireAuth(c);
    const body = await readJson<{
      name?: string;
      description?: string;
      categoryId?: string;
      levelId?: string;
      resourceType?: string;
      tags?: string;
      pricingType?: PricingType;
      price?: number;
      currency?: Currency;
      previewImageUrl?: string;
    }>(c);
    const name = body.name?.trim() ?? '';
    if (name.length < 2 || name.length > 80) {
      return c.json({ error: 'Repository name must be 2–80 characters' }, 400);
    }
    if (!body.categoryId || !CATEGORIES.some((category) => category.id === body.categoryId)) {
      return c.json({ error: 'Please choose a valid subject' }, 400);
    }
    const classification = validateClassification(body);
    if (!classification.ok) return c.json({ error: classification.error }, 400);
    const pricing = validatePricing(body);
    if (!pricing.ok) return c.json({ error: pricing.error }, 400);
    const tags = (body.tags ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);
    const repo = await createRepo({
      name,
      description: body.description?.trim() ?? '',
      categoryId: body.categoryId,
      levelId: classification.levelId,
      resourceType: classification.resourceType,
      tags,
      ownerId: authUser.id,
      pricingType: body.pricingType ?? 'free',
      price: body.pricingType === 'paid' ? Number(body.price) : 0,
      currency: (body.currency ?? 'CNY') as Currency,
      previewImageUrl: body.previewImageUrl?.trim() || undefined,
    });
    return c.json({ repo }, 201);
  });

  app.patch('/api/repos/:id', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    const repo = await getRepoById(id, null, false);
    if (!repo) return c.json({ error: 'Repository not found' }, 404);
    if (repo.ownerId !== authUser.id) {
      return c.json({ error: 'Only the owner can edit this repository' }, 403);
    }
    const body = await readJson<{
      name?: string;
      description?: string;
      categoryId?: string;
      levelId?: string;
      resourceType?: string;
      tags?: string;
      pricingType?: PricingType;
      price?: number;
      currency?: Currency;
      previewImageUrl?: string | null;
    }>(c);
    if (
      typeof body.name === 'string' &&
      (body.name.trim().length < 2 || body.name.trim().length > 80)
    ) {
      return c.json({ error: 'Repository name must be 2–80 characters' }, 400);
    }
    if (body.categoryId && !CATEGORIES.some((category) => category.id === body.categoryId)) {
      return c.json({ error: 'Please choose a valid subject' }, 400);
    }
    const patchClassification: { levelId?: EducationLevel; resourceType?: ResourceType } = {};
    if (body.levelId !== undefined || body.resourceType !== undefined) {
      const classification = validateClassification({
        levelId: body.levelId ?? repo.levelId,
        resourceType: body.resourceType ?? repo.resourceType,
      });
      if (!classification.ok) return c.json({ error: classification.error }, 400);
      patchClassification.levelId = classification.levelId;
      patchClassification.resourceType = classification.resourceType;
    }
    const patchPricing: { pricingType?: PricingType; price?: number; currency?: Currency } = {};
    if (body.pricingType !== undefined) {
      const pricing = validatePricing({
        pricingType: body.pricingType,
        price: body.price,
        currency: body.currency,
      });
      if (!pricing.ok) return c.json({ error: pricing.error }, 400);
      patchPricing.pricingType = body.pricingType;
      patchPricing.price = body.pricingType === 'paid' ? Number(body.price) : 0;
      patchPricing.currency = (body.currency ?? 'CNY') as Currency;
    }
    const tags =
      typeof body.tags === 'string'
        ? body.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 8)
        : undefined;
    const updated = await updateRepo(id, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      description: typeof body.description === 'string' ? body.description.trim() : undefined,
      categoryId: body.categoryId,
      ...patchClassification,
      tags,
      ...patchPricing,
      previewImageUrl:
        body.previewImageUrl !== undefined
          ? body.previewImageUrl === null
            ? null
            : body.previewImageUrl.trim() || undefined
          : undefined,
    });
    return c.json({ repo: updated });
  });

  app.delete('/api/repos/:id', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    const repo = await getRepoById(id, null, false);
    if (!repo) return c.json({ error: 'Repository not found' }, 404);
    if (repo.ownerId !== authUser.id) {
      return c.json({ error: 'Only the owner can delete this repository' }, 403);
    }
    await deleteRepo(id);
    return c.json({ ok: true });
  });

  // ---- Purchase / Checkout -----------------------------------------------

  app.post('/api/repos/:id/checkout', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    const repo = await getRepoById(id, null, false);
    if (!repo) return c.json({ error: 'Repository not found' }, 404);
    if (repo.ownerId === authUser.id) {
      return c.json({ error: 'You cannot purchase your own repository' }, 400);
    }
    if (repo.pricingType === 'free') {
      return c.json({ error: 'This repository is free — no checkout required' }, 400);
    }
    if (await hasUserPurchasedRepo(authUser.id, id)) {
      return c.json({ error: 'You have already purchased this repository' }, 400);
    }
    const platformFee = repo.price * PLATFORM_FEE_RATE;
    const order = await createOrder({
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
    return c.json(
      {
        order,
        formattedTotal: formatPrice(order.totalAmount, order.currency),
        platformFeeRate: PLATFORM_FEE_RATE,
      },
      201,
    );
  });

  app.post('/api/repos/:id/purchase-state', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    const repo = await getRepoById(id, null, false);
    if (!repo) return c.json({ error: 'Repository not found' }, 404);
    return c.json({
      isOwner: repo.ownerId === authUser.id,
      isPurchased: await hasUserPurchasedRepo(authUser.id, id),
      canReview: await canUserReviewRepo(authUser.id, id),
    });
  });

  // ---- Files -------------------------------------------------------------

  app.post('/api/repos/:id/files', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    const repo = await getRepoById(id, null, false);
    if (!repo) return c.json({ error: 'Repository not found' }, 404);
    if (repo.ownerId !== authUser.id) {
      return c.json({ error: 'Only the owner can add files' }, 403);
    }

    const form = await c.req.formData();
    const files: File[] = [];
    for (const value of form.values()) {
      if (value instanceof File) files.push(value);
    }
    const description = String(form.get('description') ?? '').trim();
    const rawPreview = String(form.get('isPreview') ?? '').toLowerCase();
    const isPreview = rawPreview === '1' || rawPreview === 'true';
    if (files.length === 0) return c.json({ error: 'Attach at least one file' }, 400);

    const config = getConfig();
    if (files.length > config.maxFilesPerRequest) {
      return c.json({ error: `At most ${config.maxFilesPerRequest} files per upload` }, 400);
    }

    const created = [];
    for (const file of files) {
      if (file.size > config.maxFileBytes) {
        return c.json(
          { error: `Each file must be ${Math.round(config.maxFileBytes / 1024 / 1024)}MB or smaller` },
          413,
        );
      }
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const key = `${crypto.randomUUID()}${ext}`;
      const buffer = await file.arrayBuffer();
      await putUpload(key, buffer, file.type || 'application/octet-stream');
      try {
        created.push(
          await addFileToRepo({
            repoId: id,
            title: file.name || 'file',
            description,
            fileType: inferFileType(file.name),
            fileSize: formatBytes(file.size),
            fileBytes: file.size,
            filePath: `/uploads/${key}`,
            isPreview,
          }),
        );
      } catch (error) {
        await deleteUpload(`/uploads/${key}`);
        throw error;
      }
    }
    return c.json({ files: created, repo: await getRepoById(id, authUser.id, false) }, 201);
  });

  app.get('/api/files/:id/download', async (c) => {
    const { id } = c.req.param();
    const file = await getRepoFileById(id);
    if (!file) return c.json({ error: 'File not found' }, 404);
    const repo = await getRepoById(file.repoId, null, false);
    if (!repo) return c.json({ error: 'Repository not found' }, 404);

    const authUser = c.get('authUser');
    const isOwner = authUser?.id === repo.ownerId;
    const isPurchased = authUser ? await hasUserPurchasedRepo(authUser.id, repo.id) : false;
    const isFree = repo.pricingType === 'free';
    const canDownload = isOwner || isPurchased || isFree || file.isPreview;

    if (!canDownload) {
      return c.json({ error: 'Purchase required to download this file', requiresPurchase: true }, 403);
    }

    const object = await getUpload(uploadKey(file.filePath));
    if (!object) return c.json({ error: 'File is missing on the server' }, 404);
    await incrementFileDownload(id);
    const safeTitle = file.title.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_');
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeTitle}"`,
      },
    });
  });

  // ---- Comments ----------------------------------------------------------

  app.get('/api/repos/:id/comments', async (c) => {
    const { id } = c.req.param();
    if (!(await getRepoById(id, null, false))) {
      return c.json({ error: 'Repository not found' }, 404);
    }
    return c.json({ items: await listRepoComments(id) });
  });

  app.post('/api/repos/:id/comments', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    if (!(await getRepoById(id, null, false))) {
      return c.json({ error: 'Repository not found' }, 404);
    }
    const body = await readJson<{ content?: string }>(c);
    const content = (body.content ?? '').trim();
    if (!content) return c.json({ error: 'Comment cannot be empty' }, 400);
    if (content.length > 2000) return c.json({ error: 'Comment is too long' }, 400);
    return c.json({ comment: await createRepoComment(id, authUser.id, content) }, 201);
  });

  // ---- Reviews -----------------------------------------------------------

  app.get('/api/repos/:id/reviews', async (c) => {
    const { id } = c.req.param();
    if (!(await getRepoById(id, null, false))) {
      return c.json({ error: 'Repository not found' }, 404);
    }
    return c.json({ items: await listRepoReviews(id) });
  });

  app.post('/api/repos/:id/reviews', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    if (!(await getRepoById(id, null, false))) {
      return c.json({ error: 'Repository not found' }, 404);
    }
    if (!(await canUserReviewRepo(authUser.id, id))) {
      return c.json(
        { error: 'You must purchase (or be the owner of a free repository) before reviewing' },
        403,
      );
    }
    const body = await readJson<{ rating?: number; title?: string; content?: string }>(c);
    const rating = Number(body.rating) as ReviewRating;
    if (![1, 2, 3, 4, 5].includes(rating)) {
      return c.json({ error: 'rating must be 1–5' }, 400);
    }
    const review = await createReview({
      userId: authUser.id,
      repoId: id,
      rating,
      title: (body.title ?? '').trim().slice(0, 120),
      content: (body.content ?? '').trim().slice(0, 2000),
    });
    return c.json({ review }, 201);
  });

  app.patch('/api/repos/:id/reviews/:reviewId', async (c) => {
    const authUser = await requireAuth(c);
    const { reviewId } = c.req.param();
    const body = await readJson<{ rating?: number; title?: string; content?: string }>(c);
    const rating = body.rating !== undefined ? (Number(body.rating) as ReviewRating) : undefined;
    if (rating !== undefined && ![1, 2, 3, 4, 5].includes(rating)) {
      return c.json({ error: 'rating must be 1–5' }, 400);
    }
    const review = await updateReview(reviewId, {
      rating,
      title: body.title !== undefined ? body.title.trim().slice(0, 120) : undefined,
      content: body.content !== undefined ? body.content.trim().slice(0, 2000) : undefined,
    });
    if (!review) return c.json({ error: 'Review not found' }, 404);
    if (review.userId !== authUser.id) {
      return c.json({ error: 'Only the author can edit this review' }, 403);
    }
    return c.json({ review });
  });

  app.delete('/api/repos/:id/reviews/:reviewId', async (c) => {
    const authUser = await requireAuth(c);
    const { reviewId } = c.req.param();
    const review = await getReviewById(reviewId);
    if (!review) return c.json({ error: 'Review not found' }, 404);
    if (review.userId !== authUser.id) {
      return c.json({ error: 'Only the author can delete this review' }, 403);
    }
    await deleteReview(reviewId);
    return c.json({ ok: true });
  });

  // ---- Favorites ---------------------------------------------------------

  app.post('/api/repos/:id/favorite', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    if (!(await getRepoById(id, null, false))) {
      return c.json({ error: 'Repository not found' }, 404);
    }
    const favorited = await toggleFavoriteRepo(id, authUser.id);
    return c.json({ favorited, repo: await getRepoById(id, authUser.id, false) });
  });

  app.delete('/api/repos/:id/favorite', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    await toggleFavoriteRepo(id, authUser.id);
    return c.json({ favorited: false, repo: await getRepoById(id, authUser.id, false) });
  });

  // ---- Sharing into groups ----------------------------------------------

  app.post('/api/repos/:id/groups', async (c) => {
    const authUser = await requireAuth(c);
    const { id } = c.req.param();
    const body = await readJson<{ groupId?: string }>(c);
    const repo = await getRepoById(id, null, false);
    if (!repo) return c.json({ error: 'Repository not found' }, 404);
    if (repo.ownerId !== authUser.id) {
      return c.json({ error: 'Only the owner can share this repository' }, 403);
    }
    if (!body.groupId) return c.json({ error: 'groupId is required' }, 400);
    if (!(await groupRole(body.groupId, authUser.id))) {
      return c.json({ error: 'Join the group before sharing a repository to it' }, 400);
    }
    await shareRepoToGroup(id, body.groupId);
    return c.json({ repo: await getRepoById(id, authUser.id, false) });
  });

  app.delete('/api/repos/:id/groups/:groupId', async (c) => {
    const authUser = await requireAuth(c);
    const { id, groupId } = c.req.param();
    const repo = await getRepoById(id, null, false);
    if (!repo) return c.json({ error: 'Repository not found' }, 404);
    if (repo.ownerId !== authUser.id) {
      return c.json({ error: 'Only the owner can unshare this repository' }, 403);
    }
    await unshareRepoFromGroup(id, groupId);
    return c.json({ repo: await getRepoById(id, authUser.id, false) });
  });

  // ---- Pay order directly (convenience endpoint under repo) -------------

  app.post('/api/orders/:orderId/pay', async (c) => {
    const authUser = await requireAuth(c);
    const { orderId } = c.req.param();
    const order = await getOrderById(orderId);
    if (!order) return c.json({ error: 'Order not found' }, 404);
    if (order.buyerId !== authUser.id) {
      return c.json({ error: 'Only the buyer can pay this order' }, 403);
    }
    if (order.status !== 'pending') {
      return c.json({ error: `Order is already ${order.status}` }, 400);
    }
    const result = await payOrderWithWallet(orderId, authUser.id);
    if (!result.success) {
      return c.json({ error: result.error, code: result.code }, 400);
    }
    return c.json({
      order: result.order,
      purchase: result.purchase,
      formattedTotal: result.order
        ? formatPrice(result.order.totalAmount, result.order.currency)
        : undefined,
    });
  });
}
