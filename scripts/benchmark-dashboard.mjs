import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set.');
  process.exit(1);
}

const isLocal =
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 3,
});

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarizeTimings(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count: sorted.length,
    min: Number(sorted[0].toFixed(2)),
    p50: Number(percentile(sorted, 50).toFixed(2)),
    p95: Number(percentile(sorted, 95).toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    mean: Number((sum / sorted.length).toFixed(2)),
  };
}

/** Small stand-in for src/shared/lib/cache so the benchmark runs in plain Node. */
function createTaggedCacheHarness() {
  const store = new Map();
  return {
    cached(fn, keyParts, tags, revalidate = 300) {
      return async (...args) => {
        const key = `${keyParts.join(':')}:${JSON.stringify(args)}`;
        const entry = store.get(key);
        if (entry && entry.expiresAt > Date.now()) {
          return entry.value;
        }
        const value = await fn(...args);
        store.set(key, {
          value,
          tags,
          expiresAt: Date.now() + revalidate * 1000,
        });
        return value;
      };
    },
    invalidateTags(...tags) {
      for (const [key, entry] of store.entries()) {
        if (tags.some((t) => entry.tags.includes(t))) {
          store.delete(key);
        }
      }
    },
    clear() {
      store.clear();
    },
  };
}

async function runBenchmark() {
  const client = await pool.connect();
  try {
    console.log('=== PSE Dashboard Phase 8 Benchmark (10k Contacts / 5k Pipelines / 20k Activities) ===\n');
    await client.query('BEGIN');

    // Skip the audit/history triggers while loading bulk data
    await client.query(`SET LOCAL session_replication_role = 'replica'`);

    const seedStart = performance.now();

    // 1. Fetch existing reference IDs
    const membersRes = await client.query(
      `SELECT id FROM profiles WHERE is_pse = true AND is_active = true ORDER BY full_name ASC`,
    );
    const stagesRes = await client.query(`SELECT id, kind FROM pipeline_stages ORDER BY position ASC`);
    const categoriesRes = await client.query(`SELECT id FROM contribution_categories ORDER BY name ASC`);

    const memberIds = membersRes.rows.map((r) => r.id);
    const stageIds = stagesRes.rows.map((r) => r.id);
    const wonStageId = stagesRes.rows.find((r) => r.kind === 'won').id;
    const categoryIds = categoriesRes.rows.map((r) => r.id);

    // 2. Bulk seed 10,000 contacts + 10,000 contact_channels
    await client.query(
      `WITH inserted_contacts AS (
         INSERT INTO contacts (type, name, industry, owner_id, created_at)
         SELECT
           CASE WHEN i % 3 = 0 THEN 'company'::contact_type ELSE 'individual'::contact_type END,
           'Bench Contact ' || i,
           'Technology',
           ($1::uuid[])[1 + (i % array_length($1::uuid[], 1))],
           timestamptz '2026-01-01 00:00:00Z' + ((i % 360) || ' days')::interval
         FROM generate_series(1, 10000) AS g(i)
         RETURNING id, created_at
       ),
       numbered AS (
         SELECT id, row_number() OVER () AS rn FROM inserted_contacts
       )
       INSERT INTO contact_channels (contact_id, kind, value, value_normalized, is_primary)
       SELECT
         id,
         'email'::channel_kind,
         'bench.contact.' || rn || '@example.org',
         'bench.contact.' || rn || '@example.org',
         true
       FROM numbered`,
      [memberIds],
    );

    // 3. Bulk seed 5,000 pipelines across 2026
    await client.query(
      `WITH contact_sample AS (
         SELECT id, row_number() OVER () AS rn
         FROM contacts
         LIMIT 5000
       )
       INSERT INTO pipelines (
         deal_name,
         focal_person_id,
         contribution_type,
         category_id,
         party_type,
         contact_id,
         stage_id,
         expected_amount,
         currency,
         amount_base,
         payment_interval,
         in_kind_valuation_note,
         lost_reason,
         won_at,
         created_by,
         created_at
       )
       SELECT
         'Bench Deal ' || cs.rn,
         ($1::uuid[])[1 + (cs.rn % array_length($1::uuid[], 1))],
         CASE WHEN cs.rn % 4 = 0 THEN 'in_kind'::contribution_type ELSE 'cash'::contribution_type END,
         ($2::uuid[])[1 + (cs.rn % array_length($2::uuid[], 1))],
         'individual'::party_type,
         cs.id,
         ($3::uuid[])[1 + (cs.rn % array_length($3::uuid[], 1))],
         (50000 + (cs.rn % 250) * 1000)::numeric(18, 2),
         'BDT',
         (50000 + (cs.rn % 250) * 1000)::numeric(18, 2),
         'one_time'::payment_interval,
         CASE WHEN cs.rn % 4 = 0 THEN 'Fair market valuation' ELSE NULL END,
         'Budget constraint',
         CASE
           WHEN ($3::uuid[])[1 + (cs.rn % array_length($3::uuid[], 1))] = $4::uuid
           THEN timestamptz '2026-01-05 10:00:00Z' + ((cs.rn % 350) || ' days')::interval
           ELSE NULL
         END,
         ($1::uuid[])[1 + (cs.rn % array_length($1::uuid[], 1))],
         timestamptz '2026-01-01 09:00:00Z' + ((cs.rn % 355) || ' days')::interval
       FROM contact_sample cs`,
      [memberIds, categoryIds, stageIds, wonStageId],
    );

    // 4. Bulk seed 3,000 pipeline receipts across 2026
    await client.query(
      `WITH pipe_sample AS (
         SELECT id, row_number() OVER () AS rn
         FROM pipelines
         LIMIT 3000
       )
       INSERT INTO pipeline_receipts (
         pipeline_id,
         amount,
         currency,
         amount_base,
         received_on,
         note,
         created_by
       )
       SELECT
         ps.id,
         (25000 + (ps.rn % 100) * 500)::numeric(18, 2),
         'BDT',
         (25000 + (ps.rn % 100) * 500)::numeric(18, 2),
         date '2026-01-02' + (ps.rn % 355)::int,
         'Benchmark receipt ' || ps.rn,
         ($1::uuid[])[1 + (ps.rn % array_length($1::uuid[], 1))]
       FROM pipe_sample ps`,
      [memberIds],
    );

    // 5. Bulk seed 5,000 meetings across 2026
    await client.query(
      `WITH contact_sample AS (
         SELECT id, row_number() OVER () AS rn
         FROM contacts
         LIMIT 5000
       )
       INSERT INTO meetings (
         contact_id,
         scheduled_at,
         status,
         description,
         owner_id
       )
       SELECT
         cs.id,
         timestamptz '2026-01-01 11:00:00Z' + ((cs.rn % 360) || ' days')::interval,
         CASE WHEN cs.rn % 3 = 0 THEN 'scheduled'::meeting_status ELSE 'done'::meeting_status END,
         'Benchmark meeting ' || cs.rn,
         ($1::uuid[])[1 + (cs.rn % array_length($1::uuid[], 1))]
       FROM contact_sample cs`,
      [memberIds],
    );

    // 6. Bulk seed 20,000 activities across 2026
    await client.query(
      `WITH contact_sample AS (
         SELECT id, row_number() OVER () AS rn
         FROM contacts
         LIMIT 10000
       )
       INSERT INTO activities (
         type,
         class,
         title,
         owner_id,
         contact_id,
         status,
         occurred_at,
         created_at
       )
       SELECT
         (ARRAY['visit','event','campaign','servicing','general']::activity_type[])[1 + (g.i % 5)],
         (ARRAY['stewardship','prospect_engagement','independent']::activity_class[])[1 + (g.i % 3)],
         'Benchmark activity ' || g.i,
         ($1::uuid[])[1 + (g.i % array_length($1::uuid[], 1))],
         cs.id,
         CASE WHEN g.i % 20 = 0 THEN 'cancelled'::activity_status ELSE 'done'::activity_status END,
         timestamptz '2026-01-01 14:00:00Z' + ((g.i % 360) || ' days')::interval,
         timestamptz '2026-01-01 14:00:00Z' + ((g.i % 360) || ' days')::interval
       FROM generate_series(1, 20000) AS g(i)
       JOIN contact_sample cs ON cs.rn = 1 + ((g.i - 1) % 10000)`,
      [memberIds],
    );

    await client.query(`SET LOCAL session_replication_role = 'origin'`);
    await client.query(
      `ANALYZE contacts, contact_channels, pipelines, pipeline_receipts, meetings, activities`,
    );

    const countsRes = await client.query(`
      SELECT
        (SELECT count(*)::int FROM contacts) AS contacts,
        (SELECT count(*)::int FROM pipelines) AS pipelines,
        (SELECT count(*)::int FROM pipeline_receipts) AS receipts,
        (SELECT count(*)::int FROM meetings) AS meetings,
        (SELECT count(*)::int FROM activities) AS activities
    `);
    const counts = countsRes.rows[0];
    console.log(
      `Seeded & analyzed in ${((performance.now() - seedStart) / 1000).toFixed(2)}s:`,
      counts,
    );

    // 7. EXPLAIN ANALYZE the key functions
    const start = '2026-10-01';
    const end = '2026-12-31';

    const explainQueries = [
      {
        name: 'fn_achievement (Q4 2026)',
        sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM fn_achievement($1::date, $2::date, NULL, NULL)`,
        params: [start, end],
      },
      {
        name: 'fn_pipeline_by_kind (Q4 2026)',
        sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM fn_pipeline_by_kind($1::date, $2::date, NULL, NULL)`,
        params: [start, end],
      },
      {
        name: 'fn_won_unrealized (Q4 2026)',
        sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM fn_won_unrealized($1::date, $2::date, NULL, NULL)`,
        params: [start, end],
      },
      {
        name: 'fn_activity_summary (Q4 2026)',
        sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM fn_activity_summary($1::date, $2::date, NULL)`,
        params: [start, end],
      },
      {
        name: 'fn_contacts_engaged (Q4 2026)',
        sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT fn_contacts_engaged($1::date, $2::date, NULL)`,
        params: [start, end],
      },
      {
        name: 'fn_member_workload (Q4 2026)',
        sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM fn_member_workload($1::date, $2::date, NULL)`,
        params: [start, end],
      },
      {
        name: 'fn_trend (FY 2026)',
        sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM fn_trend(2026, NULL, NULL)`,
        params: [],
      },
    ];

    console.log('\n--- EXPLAIN (ANALYZE, BUFFERS) Plans ---');
    for (const q of explainQueries) {
      const planRes = await client.query(q.sql, q.params);
      console.log(`\n[${q.name}]`);
      for (const r of planRes.rows) {
        console.log('  ' + r['QUERY PLAN']);
      }
    }

    // 8. Same SQL as src/modules/dashboard/repository.ts
    const fetchMonetaryOnClient = async (wStart, wEnd, member, vertical, year, quarter, month) => {
      const res = await client.query(
        `SELECT
           COALESCE((
             SELECT json_agg(row_to_json(r))
             FROM (
               SELECT user_id, vertical_id, achieved::float8 AS achieved
               FROM fn_achievement($1::date, $2::date, $3::uuid, $4::uuid)
             ) r
           ), '[]'::json) AS achievements,
           COALESCE((
             SELECT json_agg(row_to_json(r))
             FROM (
               SELECT user_id, vertical_id, target::float8 AS target
               FROM fn_target($5::int, $6::int, $7::int, $3::uuid, $4::uuid)
             ) r
           ), '[]'::json) AS targets,
           COALESCE((
             SELECT json_agg(row_to_json(r))
             FROM (
               SELECT kind, pipeline_count, expected_base::float8 AS expected_base,
                      cash_base::float8 AS cash_base, in_kind_base::float8 AS in_kind_base
               FROM fn_pipeline_by_kind($1::date, $2::date, $3::uuid, $4::uuid)
             ) r
           ), '[]'::json) AS pipeline_by_kind,
           (
             SELECT row_to_json(r)
             FROM (
               SELECT won_base::float8 AS won_base, received_base::float8 AS received_base,
                      unrealized_base::float8 AS unrealized_base
               FROM fn_won_unrealized($1::date, $2::date, $3::uuid, $4::uuid)
             ) r
           ) AS won_unrealized,
           fn_lead_count($1::date, $2::date, $3::uuid, $4::uuid) AS lead_count,
           COALESCE((
             SELECT json_agg(row_to_json(r))
             FROM (
               SELECT month_index, month_start::text AS month_start, achieved::float8 AS achieved
               FROM fn_trend($5::int, $3::uuid, $4::uuid)
             ) r
           ), '[]'::json) AS trend`,
        [wStart, wEnd, member, vertical, year, quarter, month],
      );
      return res.rows[0];
    };

    const fetchNonMonetaryOnClient = async (wStart, wEnd, member) => {
      const res = await client.query(
        `SELECT
           COALESCE((
             SELECT json_agg(row_to_json(r))
             FROM (
               SELECT status, meeting_count
               FROM fn_meeting_summary($1::date, $2::date, $3::uuid)
             ) r
           ), '[]'::json) AS meetings,
           COALESCE((
             SELECT json_agg(row_to_json(r))
             FROM (
               SELECT type, class, activity_count, distinct_contacts
               FROM fn_activity_summary($1::date, $2::date, $3::uuid)
             ) r
           ), '[]'::json) AS activities,
           fn_contacts_engaged($1::date, $2::date, $3::uuid) AS engaged,
           COALESCE((
             SELECT json_agg(row_to_json(r))
             FROM (
               SELECT user_id, full_name, meeting_count, activity_count
               FROM fn_member_workload($1::date, $2::date, $3::uuid)
             ) r
           ), '[]'::json) AS workload`,
        [wStart, wEnd, member],
      );
      return res.rows[0];
    };

    const fetchOptionsOnClient = async () => {
      const res = await client.query(
        `SELECT
           COALESCE((SELECT json_agg(row_to_json(m)) FROM (SELECT id, full_name FROM profiles WHERE is_pse = true AND is_active = true ORDER BY full_name ASC) m), '[]'::json) AS members,
           COALESCE((SELECT json_agg(row_to_json(v)) FROM (SELECT id, name FROM verticals ORDER BY name ASC) v), '[]'::json) AS verticals`,
      );
      return res.rows[0];
    };

    // 9. Benchmark Cold DB Reads (20 iterations, bypassing cache)
    const coldSamples = [];
    for (let i = 0; i < 20; i += 1) {
      const t0 = performance.now();
      await fetchMonetaryOnClient(start, end, null, null, 2026, 4, null);
      await fetchNonMonetaryOnClient(start, end, null);
      await fetchOptionsOnClient();
      coldSamples.push(performance.now() - t0);
    }
    const coldStats = summarizeTimings(coldSamples);

    // 10. Benchmark Warm Tagged Cache Reads (50 iterations)
    const cache = createTaggedCacheHarness();
    const cachedMonetary = cache.cached(
      fetchMonetaryOnClient,
      ['dashboard-monetary'],
      ['dashboard', 'receipts', 'pipelines', 'targets', 'config'],
    );
    const cachedNonMonetary = cache.cached(
      fetchNonMonetaryOnClient,
      ['dashboard-non-monetary'],
      ['dashboard', 'meetings', 'activities', 'contacts', 'pipelines', 'config'],
    );
    const cachedOptions = cache.cached(fetchOptionsOnClient, ['dashboard-filter-options'], ['config']);

    // Prime the cache once (sequentially on the single transaction client)
    await cachedMonetary(start, end, null, null, 2026, 4, null);
    await cachedNonMonetary(start, end, null);
    await cachedOptions();

    const warmSamples = [];
    for (let i = 0; i < 50; i += 1) {
      const t0 = performance.now();
      await Promise.all([
        cachedMonetary(start, end, null, null, 2026, 4, null),
        cachedNonMonetary(start, end, null),
        cachedOptions(),
      ]);
      warmSamples.push(performance.now() - t0);
    }
    const warmStats = summarizeTimings(warmSamples);

    console.log('\n--- Timing Summary (ms) ---');
    console.log('Cold DB Miss (Monetary + Non-Monetary + Options over remote pooler):', coldStats);
    console.log('Warm Tagged Cache Hit (Monetary + Non-Monetary + Options):          ', warmStats);

    assert.ok(
      warmStats.p95 < 300,
      `Expected warm cache p95 < 300ms, got ${warmStats.p95}ms`,
    );

    // 11. Verify Write -> Tag Invalidation -> Immediate Fresh Achievement Read
    const beforeData = await cachedMonetary(start, end, null, null, 2026, 4, null);
    const achievedBefore = (beforeData.achievements ?? []).reduce(
      (acc, r) => acc + Number(r.achieved),
      0,
    );

    const anyPipe = (await client.query(`SELECT id FROM pipelines LIMIT 1`)).rows[0];
    const delta = 250000;
    await client.query(
      `INSERT INTO pipeline_receipts (pipeline_id, amount, currency, amount_base, received_on, note)
       VALUES ($1, $2, 'BDT', $2, '2026-11-15', 'Cache invalidation verification receipt')`,
      [anyPipe.id, delta],
    );

    // Before invalidation, cached read still returns the old value
    const staleData = await cachedMonetary(start, end, null, null, 2026, 4, null);
    const achievedStale = (staleData.achievements ?? []).reduce(
      (acc, r) => acc + Number(r.achieved),
      0,
    );
    assert.equal(achievedStale, achievedBefore, 'Cached value should remain before invalidateTags');

    // Invalidate receipt tags (matching recordPipelineReceiptAction)
    cache.invalidateTags('receipts', 'pipelines', 'dashboard');

    const afterData = await cachedMonetary(start, end, null, null, 2026, 4, null);
    const achievedAfter = (afterData.achievements ?? []).reduce(
      (acc, r) => acc + Number(r.achieved),
      0,
    );
    assert.equal(
      achievedAfter,
      achievedBefore + delta,
      'After invalidateTags(receipts, pipelines, dashboard), achievement must immediately include the new receipt',
    );
    console.log(
      `\n✓ Cache invalidation verified: before=${achievedBefore} BDT -> +${delta} BDT receipt + invalidateTags -> after=${achievedAfter} BDT`,
    );
    console.log(`✓ Warm cache p95 = ${warmStats.p95} ms (target < 300 ms)`);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
