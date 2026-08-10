import type { IconType } from 'react-icons';
import {
  FaFileAlt,
  FaFileCode,
  FaFileImage,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileWord,
} from 'react-icons/fa';
import type { FileType } from '@sciehub/shared';
import { cn } from '@/lib/utils';

const ICONS: Record<FileType, IconType> = {
  pdf: FaFilePdf,
  doc: FaFileWord,
  ppt: FaFilePowerpoint,
  image: FaFileImage,
  code: FaFileCode,
  other: FaFileAlt,
};

const COLORS: Record<FileType, string> = {
  pdf: 'text-error',
  doc: 'text-accent',
  ppt: 'text-warning',
  image: 'text-success',
  code: 'text-accent',
  other: 'text-muted-foreground',
};

export function FileTypeIcon({ type, className }: { type: FileType; className?: string }) {
  const Icon = ICONS[type];
  return <Icon className={cn(COLORS[type], className)} aria-hidden />;
}
