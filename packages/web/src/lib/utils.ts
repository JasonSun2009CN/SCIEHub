import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const UNITS = ['', 'K', 'M', 'B'];

/** 1420 -> "1.4K" */
export function formatNumber(value: number): string {
  if (value < 1000) return String(value);
  const tier = Math.min(Math.floor(Math.log10(value) / 3), UNITS.length - 1);
  const scaled = value / Math.pow(10, tier * 3);
  return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(1)}${UNITS[tier]}`;
}

/** ISO timestamp -> "3d ago" */
export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
