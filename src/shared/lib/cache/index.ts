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
 * Wrapper around Next's unstable_cache so modules never import cache primitives directly.
 * Authorise with requireUser() before calling a cached function.
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

/** Invalidates cache tags after a write. */
export function invalidateTags(...tags: CacheTag[]): void {
  for (const tag of tags) {
    revalidateTag(tag, 'max');
  }
}
