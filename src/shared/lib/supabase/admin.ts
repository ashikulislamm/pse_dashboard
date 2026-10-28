import 'server-only';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

declare global {
  var __psePgPool: Pool | undefined;
}

/** Shared pg pool from `DATABASE_URL`. SSL is on for remote hosts. */
export function getDbPool(): Pool {
  if (globalThis.__psePgPool) {
    return globalThis.__psePgPool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL environment variable.');
  }

  const isLocal =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  // Optional: set DATABASE_CA_CERT (PEM contents) to fully verify the Supabase TLS chain.
  // Without it the connection is encrypted but the server certificate is not verified.
  const caCert = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n');
  const ssl = isLocal
    ? false
    : caCert
      ? { ca: caCert, rejectUnauthorized: true }
      : { rejectUnauthorized: false };

  // Serverless-friendly: each Vercel instance holds its own pool against the pooler's
  // limited client slots, so keep it small. Override with DATABASE_POOL_MAX.
  const parsedMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '', 10);
  const max = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 3;

  const pool = new Pool({
    connectionString,
    ssl,
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  // Always reuse the pool (dev HMR and warm production instances). Caching only outside
  // production would create a brand-new pool on every query.
  globalThis.__psePgPool = pool;

  return pool;
}

/** Runs a parameterised query on the pool. Authorise with requireUser() first. */
export async function queryDb<TRow extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<TRow>> {
  const pool = getDbPool();
  return pool.query<TRow>(sql, params);
}

/** Owner-level db client for cached reads and scripts. Server only. */
export function createSupabaseAdminClient() {
  const pool = getDbPool();
  return {
    pool,
    query: <TRow extends QueryResultRow = QueryResultRow>(
      sql: string,
      params: unknown[] = [],
    ) => pool.query<TRow>(sql, params),
  };
}

export type { Pool, PoolClient, QueryResult, QueryResultRow };
