import type { IconType } from 'react-icons';
import {
  FaFileAlt,
  FaFileArchive,
  FaFileAudio,
  FaFileCode,
  FaFileImage,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileVideo,
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
  audio: FaFileAudio,
  video: FaFileVideo,
  archive: FaFileArchive,
  other: FaFileAlt,
};

const COLORS: Record<FileType, string> = {
  pdf: 'text-error',
  doc: 'text-accent',
  ppt: 'text-warning',
  image: 'text-success',
  code: 'text-accent',
  audio: 'text-success',
  video: 'text-warning',
  archive: 'text-accent',
  other: 'text-muted-foreground',
};

export function FileTypeIcon({ type, className }: { type: FileType; className?: string }) {
  const Icon = ICONS[type];
  return <Icon className={cn(COLORS[type], className)} aria-hidden />;
}
