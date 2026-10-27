import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, { value: unknown; tags: string[]; revalidate: number }>();
const revalidateCalls: Array<{ tag: string; profile?: string }> = [];

vi.mock('next/cache', () => ({
  unstable_cache: <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    keyParts: string[],
    options: { tags: string[]; revalidate: number },
  ) => {
    return async (...args: TArgs): Promise<TResult> => {
      const serializedKey = `${keyParts.join(':')}:${JSON.stringify(args)}`;
      const hit = store.get(serializedKey);
      if (hit) {
        return hit.value as TResult;
      }
      const value = await fn(...args);
      store.set(serializedKey, {
        value,
        tags: options.tags,
        revalidate: options.revalidate,
      });
      return value;
    };
  },
  revalidateTag: (tag: string, profile?: string) => {
    revalidateCalls.push({ tag, profile });
    for (const [key, entry] of store.entries()) {
      if (entry.tags.includes(tag)) {
        store.delete(key);
      }
    }
  },
}));

import { CACHE_TAGS, cached, invalidateTags } from './index';

describe('shared/lib/cache', () => {
  beforeEach(() => {
    store.clear();
    revalidateCalls.length = 0;
  });

  it('exposes the canonical cache tags from ARCHITECURE.md §10.3', () => {
    expect(CACHE_TAGS).toEqual({
      dashboard: 'dashboard',
      pipelines: 'pipelines',
      receipts: 'receipts',
      meetings: 'meetings',
      activities: 'activities',
      targets: 'targets',
      config: 'config',
      contacts: 'contacts',
    });
  });

  it('caches results by keyParts + filter arguments with a 300s default TTL', async () => {
    let dbCalls = 0;
    const loadMonetary = cached(
      async (period: string, year: number, member: string | null) => {
        dbCalls += 1;
        return { period, year, member, achieved: dbCalls * 1000 };
      },
      ['dashboard-monetary'],
      [CACHE_TAGS.dashboard, CACHE_TAGS.receipts, CACHE_TAGS.pipelines],
    );

    const first = await loadMonetary('quarter', 2026, null);
    const second = await loadMonetary('quarter', 2026, null);
    expect(first).toEqual({ period: 'quarter', year: 2026, member: null, achieved: 1000 });
    expect(second).toEqual(first);
    expect(dbCalls).toBe(1);

    // Different filter arguments miss the cache and create a separate entry
    const filtered = await loadMonetary('quarter', 2026, 'user-1');
    expect(filtered.achieved).toBe(2000);
    expect(dbCalls).toBe(2);

    const entry = store.get('dashboard-monetary:["quarter",2026,null]');
    expect(entry?.revalidate).toBe(300);
    expect(entry?.tags).toEqual(['dashboard', 'receipts', 'pipelines']);
  });

  it('invalidates tagged entries immediately when a write action calls invalidateTags', async () => {
    let achievementTotal = 500_000;
    const loadMonetary = cached(
      async (year: number) => ({ year, achieved: achievementTotal }),
      ['dashboard-monetary'],
      [CACHE_TAGS.dashboard, CACHE_TAGS.receipts, CACHE_TAGS.pipelines],
    );
    const loadConfig = cached(
      async () => ({ fiscalStart: 1 }),
      ['dashboard-fiscal-start'],
      [CACHE_TAGS.config],
    );

    expect((await loadMonetary(2026)).achieved).toBe(500_000);
    expect((await loadConfig()).fiscalStart).toBe(1);

    // Simulate recording a receipt: achievement increases and receipt tags are invalidated
    achievementTotal = 750_000;
    invalidateTags(CACHE_TAGS.receipts, CACHE_TAGS.pipelines, CACHE_TAGS.dashboard);

    expect(revalidateCalls).toEqual([
      { tag: 'receipts', profile: 'max' },
      { tag: 'pipelines', profile: 'max' },
      { tag: 'dashboard', profile: 'max' },
    ]);

    // Subsequent read reflects the new achievement figure immediately
    expect((await loadMonetary(2026)).achieved).toBe(750_000);
    // Unrelated config tag remains cached
    expect(store.has('dashboard-fiscal-start:[]')).toBe(true);
  });
});
