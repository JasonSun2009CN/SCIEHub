import { useCallback, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FaCheck,
  FaCloudUploadAlt,
  FaCoins,
  FaDollarSign,
  FaEye,
  FaFile,
  FaPlus,
  FaSpinner,
  FaTimes,
} from 'react-icons/fa';
import {
  CATEGORIES,
  CURRENCIES,
  MAX_FILE_PRICE,
  PLATFORM_FEE_RATE,
  formatPrice,
  type Currency,
  type Group,
  type PricingType,
  type RepoFile,
  type Repository,
} from '@sciehub/shared';
import { api, uploadFiles } from '@/lib/api';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileTypeIcon } from '@/components/generated/FileTypeIcon';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { cn } from '@/lib/utils';

interface QueuedFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

let queueCounter = 0;

export function UploadPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const presetRepoId = searchParams.get('repo') ?? '';

  const [targetRepo, setTargetRepo] = useState<string>(presetRepoId);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  // New-repo fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [shareGroupIds, setShareGroupIds] = useState<string[]>([]);
  const [pricingType, setPricingType] = useState<PricingType>('free');
  const [price, setPrice] = useState<string>('9.9');
  const [currency, setCurrency] = useState<Currency>('CNY');
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [markPreview, setMarkPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: myGroups } = useQuery({
    queryKey: ['myGroups', user?.username],
    queryFn: () => api<{ items: Group[] }>(`/users/${user!.username}/groups`),
    enabled: Boolean(user),
  });

  const { data: myRepos } = useQuery({
    queryKey: ['myRepos', user?.username],
    queryFn: () => api<{ items: Repository[] }>(`/users/${user!.username}/repos`),
    enabled: Boolean(user),
  });

  const isNewRepo = targetRepo === '';

  const addFiles = useCallback((incoming: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...incoming.map((file) => ({ id: `f${++queueCounter}`, file, progress: 0, status: 'pending' as const })),
    ]);
  }, []);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const toggleShareGroup = (groupId: string) => {
    setShareGroupIds((prev) => (prev.includes(groupId) ? prev.filter((g) => g !== groupId) : [...prev, groupId]));
  };

  const startUpload = async () => {
    if (!user) return;
    if (files.length === 0) {
      toast('Add at least one file', 'error');
      return;
    }
    if (isNewRepo && (!name.trim() || !categoryId)) {
      toast(isNewRepo && !name.trim() ? 'Repository name is required' : 'Choose a category', 'error');
      return;
    }
    if (pricingType === 'paid') {
      const n = Number(price);
      if (!Number.isFinite(n) || n <= 0 || n > MAX_FILE_PRICE) {
        toast(`Price must be between 0 and ${MAX_FILE_PRICE}`, 'error');
        return;
      }
    }

    setBusy(true);
    try {
      let repoId = targetRepo;
      if (isNewRepo) {
        const created = await api<{ repo: Repository }>('/repos', {
          method: 'POST',
          json: {
            name: name.trim(),
            description: description.trim(),
            categoryId,
            tags,
            pricingType,
            price: pricingType === 'paid' ? Number(price) : 0,
            currency,
            previewImageUrl: previewImageUrl.trim() || undefined,
          },
        });
        repoId = created.repo.id;
        for (const gid of shareGroupIds) {
          await api(`/repos/${repoId}/groups`, { method: 'POST', json: { groupId: gid } });
        }
      }

      const createdIds: string[] = [];
      for (const queued of files) {
        setFiles((prev) => prev.map((f) => (f.id === queued.id ? { ...f, status: 'uploading', progress: 0 } : f)));
        const form = new FormData();
        form.append('description', description.trim());
        form.append('file', queued.file, queued.file.name);
        if (markPreview) form.append('isPreview', '1');
        try {
          const result = await uploadFiles(`/api/repos/${repoId}/files`, form, (percent) => {
            setFiles((prev) => prev.map((f) => (f.id === queued.id ? { ...f, progress: percent } : f)));
          });
          const fileId = (result as { files: RepoFile[] }).files[0]?.id;
          if (fileId) createdIds.push(fileId);
          setFiles((prev) => prev.map((f) => (f.id === queued.id ? { ...f, status: 'done', progress: 100 } : f)));
        } catch (err) {
          setFiles((prev) =>
            prev.map((f) => (f.id === queued.id ? { ...f, status: 'error', error: (err as Error).message } : f)),
          );
        }
      }

      queryClient.invalidateQueries({ queryKey: ['repos'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['repo', repoId] });
      queryClient.invalidateQueries({ queryKey: ['myRepos'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });

      if (createdIds.length > 0) {
        toast(`Uploaded ${createdIds.length} file${createdIds.length > 1 ? 's' : ''}`, 'success');
        navigate(`/repos/${repoId}`);
      } else {
        toast('Upload failed — check the errors below', 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace state={{ from: '/upload' }} />;

  const doneCount = files.filter((f) => f.status === 'done').length;
  const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);
  const uploadedBytes = files.reduce((sum, f) => sum + Math.round((f.file.size * f.progress) / 100), 0);
  const availableGroups = useMemo(() => myGroups?.items ?? [], [myGroups]);
  const availableRepos = useMemo(() => myRepos?.items ?? [], [myRepos]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMeta title="Upload" description="Create a repository and share your study files on SCIEHub." />
      <h1 className="text-2xl font-bold">Upload files</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a new repository or add files to one you own. Multiple files become the repository's content.
      </p>

      {/* Target */}
      <div className="mt-6 space-y-2">
        <Label>Upload to</Label>
        <Select value={targetRepo} onValueChange={setTargetRepo}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a destination" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">＋ New repository</SelectItem>
            {availableRepos.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* New repo fields */}
      {isNewRepo ? (
        <div className="mt-5 space-y-5 rounded-lg border border-border bg-surface p-6">
          <div className="space-y-2">
            <Label htmlFor="repo-name">Repository name *</Label>
            <Input
              id="repo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IB Physics — Waves Notes"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repo-desc">Description</Label>
            <Textarea
              id="repo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this repository cover?"
              rows={2}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="repo-tags">Tags</Label>
              <Input id="repo-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="math, notes, exam" />
            </div>
          </div>
          {availableGroups.length > 0 && (
            <div className="space-y-2">
              <Label>Share to groups (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {availableGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleShareGroup(g.id)}
                    className={cn(
                      'cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors',
                      shareGroupIds.includes(g.id)
                        ? 'border-accent bg-accent-subtle text-accent'
                        : 'border-border bg-surface-2 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {shareGroupIds.includes(g.id) && <FaCheck className="mr-1 inline h-2.5 w-2.5" />}
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-5 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          Adding files to <span className="font-medium text-foreground">{availableRepos.find((r) => r.id === targetRepo)?.name}</span>.
        </p>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'mt-6 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
          dragOver ? 'border-accent bg-accent-subtle' : 'border-border bg-surface',
        )}
      >
        <FaCloudUploadAlt className={cn('h-12 w-12', dragOver ? 'text-accent' : 'text-muted-foreground')} />
        <div>
          <p className="font-medium">Drag &amp; drop files here, or</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            <FaPlus className="h-4 w-4" /> Browse files
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">PDF, Word, PowerPoint, images, code — up to 50 MB each</p>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPick} />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-3">
                <FileTypeIcon type="other" className="h-5 w-5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{item.file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{(item.file.size / 1024).toFixed(1)} KB</span>
                  </div>
                  {item.status === 'error' && <p className="text-xs text-error">{item.error}</p>}
                </div>
                {item.status === 'uploading' ? (
                  <FaSpinner className="h-4 w-4 animate-spin text-accent" />
                ) : item.status === 'done' ? (
                  <span className="text-xs font-medium text-success">Done</span>
                ) : (
                  <button
                    onClick={() => removeFile(item.id)}
                    disabled={busy}
                    aria-label={`Remove ${item.file.name}`}
                    className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-error disabled:opacity-40"
                  >
                    <FaTimes className="h-4 w-4" />
                  </button>
                )}
              </div>
              {item.status === 'uploading' && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${item.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Submit */}
      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        {files.length > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-md bg-surface-2 p-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <FaFile className="h-4 w-4" />
              {doneCount}/{files.length} uploaded · {(uploadedBytes / 1024).toFixed(0)}/{totalBytes > 0 ? (totalBytes / 1024).toFixed(0) : 0} KB
            </span>
            <span className="ml-auto font-medium text-accent">{totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0}%</span>
          </div>
        )}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate('/feed')}>
            Cancel
          </Button>
          <Button onClick={() => void startUpload()} disabled={busy || files.length === 0}>
            {busy ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaCloudUploadAlt className="h-4 w-4" />}
            {busy ? 'Uploading…' : `Upload ${files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
