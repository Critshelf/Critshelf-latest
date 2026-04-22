import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPlayTime(playTime: string | number | null | undefined): string {
  if (!playTime) return 'N/A';
  if (typeof playTime === 'number') {
    return `${playTime} min`;
  }
  return playTime.toString();
}
