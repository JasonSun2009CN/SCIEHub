import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { FaTimes } from 'react-icons/fa';
import { cn } from '@/lib/utils';

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  placeholder?: string;
  className?: string;
}

function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim();
}

export function TagInput({
  id,
  value,
  onChange,
  max = 8,
  placeholder = 'Type a tag and press Enter',
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const candidates = raw
      .split(/[,\n]+/)
      .map(normalizeTag)
      .filter(Boolean);
    if (candidates.length === 0) return;

    const next = [...value];
    for (const candidate of candidates) {
      if (next.length >= max) break;
      if (!next.some((tag) => tag.toLowerCase() === candidate.toLowerCase())) {
        next.push(candidate);
      }
    }
    onChange(next);
    setDraft('');
  };

  const remove = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (draft.trim()) commit(draft);
      return;
    }
    if (event.key === 'Backspace' && !draft && value.length > 0) {
      event.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (text.includes(',') || text.includes('\n')) {
      event.preventDefault();
      commit(text);
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-input bg-surface-2/55 px-3 py-1.5 text-sm transition-colors focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-ring/50',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent-subtle px-2.5 py-0.5 text-xs font-medium text-accent"
        >
          {tag}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              remove(tag);
            }}
            className="cursor-pointer rounded-full p-0.5 transition-colors hover:bg-accent/15 hover:text-foreground"
            aria-label={`Remove tag ${tag}`}
          >
            <FaTimes className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        id={id}
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          if (draft.trim()) commit(draft);
        }}
        placeholder={value.length === 0 ? placeholder : value.length >= max ? 'Tag limit reached' : 'Add another…'}
        disabled={value.length >= max && !draft}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed"
      />
      <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
        {value.length}/{max}
      </span>
    </div>
  );
}
