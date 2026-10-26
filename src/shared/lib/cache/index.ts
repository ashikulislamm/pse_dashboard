import { revalidateTag, unstable_cache } from 'next/cache';

export const CACHE_TAGS = {
  dashboard: 'dashboard',
  pipelines: 'pipelines',
  receipts: 'receipts',
  meetings: 'meetings',
  activities: 'activities',
  targets: 'targets',
  config: 'config',
  contacts: 'contacts',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

const DEFAULT_REVALIDATE_SECONDS = 300; // 5 minutes fallback TTL (ARCHITECURE.md §10.3)

/**
 * Single wrapper around Next.js server data cache (`unstable_cache`).
 * Ensures all modules use uniform key parts, cache tags, and fallback TTL without
 * importing Next cache primitives directly.
 *
 * IMPORTANT: Callers MUST verify user authorization (`requireUser()`) BEFORE invoking
 * a cached function that uses the service-role client.
 */
export function cached<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts: string[],
  tags: CacheTag[],
  revalidate: number = DEFAULT_REVALIDATE_SECONDS,
): (...args: TArgs) => Promise<TResult> {
  return unstable_cache(fn, keyParts, {
    tags,
    revalidate,
  });
}

/**
 * Revalidates one or more server cache tags immediately after a write action.
 */
export function invalidateTags(...tags: CacheTag[]): void {
  for (const tag of tags) {
    revalidateTag(tag, 'max');
  }
}
