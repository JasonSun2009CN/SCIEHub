import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FaCloudUploadAlt, FaFile, FaPlus, FaSpinner, FaTimes } from 'react-icons/fa';
import { CATEGORIES, type Group } from '@sciehub/shared';
import { api, getToken, uploadResource } from '@/lib/api';
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

  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [tags, setTags] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: myGroups } = useQuery({
    queryKey: ['myGroups', user?.username],
    queryFn: () => api<{ items: Group[] }>(`/users/${user!.username}/groups`),
    enabled: Boolean(user),
  });

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

  const startUpload = async () => {
    if (!user) return;
    if (files.length === 0) {
      toast('Add at least one file', 'error');
      return;
    }
    if (!title.trim()) {
      toast('Title is required', 'error');
      return;
    }
    if (!categoryId) {
      toast('Choose a category', 'error');
      return;
    }

    setBusy(true);
    const createdIds: string[] = [];
    const token = getToken();

    for (const queued of files) {
      setFiles((prev) => prev.map((f) => (f.id === queued.id ? { ...f, status: 'uploading', progress: 0 } : f)));
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('categoryId', categoryId);
      if (groupId) form.append('groupId', groupId);
      form.append('tags', tags);
      form.append('file', queued.file, queued.file.name);

      try {
        const result = await uploadResource(form, (percent) => {
          setFiles((prev) => prev.map((f) => (f.id === queued.id ? { ...f, progress: percent } : f)));
        });
        void token;
        const resourceId = (result as { resource: { id: string } }).resource.id;
        createdIds.push(resourceId);
        setFiles((prev) => prev.map((f) => (f.id === queued.id ? { ...f, status: 'done', progress: 100 } : f)));
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) => (f.id === queued.id ? { ...f, status: 'error', error: (err as Error).message } : f)),
        );
      }
    }

    setBusy(false);
    queryClient.invalidateQueries({ queryKey: ['resources'] });
    queryClient.invalidateQueries({ queryKey: ['home'] });

    if (createdIds.length > 0) {
      toast(`Uploaded ${createdIds.length} resource${createdIds.length > 1 ? 's' : ''}`, 'success');
      navigate(`/resources/${createdIds[0]}`);
    } else {
      toast('Upload failed — check the errors below', 'error');
    }
  };

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace state={{ from: '/upload' }} />;

  const doneCount = files.filter((f) => f.status === 'done').length;
  const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);
  const uploadedBytes = files.reduce((sum, f) => sum + Math.round((f.file.size * f.progress) / 100), 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMeta title="Upload" description="Share a study resource on SCIEHub." />
      <h1 className="text-2xl font-bold">Upload resources</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Share notes, past papers or cheat sheets with your classmates. Multiple files become separate resources.
      </p>

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
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <FaPlus className="h-4 w-4" /> Browse files
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">PDF, Word, PowerPoint, images, code — up to 50&nbsp;MB each</p>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPick} />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-3">
                <FileTypeIcon type={item.status === 'error' ? 'other' : 'doc'} className="h-5 w-5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{item.file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(item.file.size / 1024).toFixed(1)} KB
                    </span>
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

      {/* Metadata form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void startUpload();
        }}
        className="mt-6 space-y-5 rounded-lg border border-border bg-surface p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="upload-title">Title *</Label>
          <Input
            id="upload-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. IB Physics — Waves Past Paper Walkthrough"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="upload-desc">Description</Label>
          <Textarea
            id="upload-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this resource? What topics does it cover?"
            rows={3}
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
            <Label>Group (optional)</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Only groups you've joined" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No group</SelectItem>
                {(myGroups?.items ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="upload-tags">Tags</Label>
          <Input
            id="upload-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="math, notes, exam — comma separated"
          />
        </div>

        {files.length > 0 && (
          <div className="flex items-center gap-3 rounded-md bg-surface-2 p-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <FaFile className="h-4 w-4" />
              {doneCount}/{files.length} uploaded · {(uploadedBytes / 1024).toFixed(0)}/{totalBytes > 0 ? (totalBytes / 1024).toFixed(0) : 0} KB
            </span>
            <span className="ml-auto font-medium text-accent">
              {totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0}%
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={() => navigate('/feed')}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || files.length === 0}>
            {busy ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaCloudUploadAlt className="h-4 w-4" />}
            {busy ? 'Uploading…' : `Upload ${files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
