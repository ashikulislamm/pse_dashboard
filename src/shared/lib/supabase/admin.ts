import 'server-only';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

declare global {
  var __psePgPool: Pool | undefined;
}

/**
 * Returns a singleton PostgreSQL connection pool connected via `DATABASE_URL` (Supabase Cloud URI).
 * Automatically enables SSL for remote Supabase Cloud connections.
 */
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

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__psePgPool = pool;
  }

  return pool;
}

/**
 * Executes a parameterized SQL query directly against the PostgreSQL pool.
 * Used by server-only cached aggregate queries AFTER caller authorization (`requireUser()`).
 */
export async function queryDb<TRow extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<TRow>> {
  const pool = getDbPool();
  return pool.query<TRow>(sql, params);
}

/**
 * Server-only admin database client wrapper.
 * Used inside cached read functions and migration/seed scripts.
 */
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
