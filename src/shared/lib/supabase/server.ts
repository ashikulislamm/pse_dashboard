import 'server-only';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDbPool, queryDb } from './admin';

/**
 * Runs a callback inside a PostgreSQL transaction scoped to `userId`.
 * Sets `request.jwt.claim.sub` and `app.current_user_id` locally for the transaction
 * so PostgreSQL Row-Level Security (RLS) policies (`auth.uid()`) and audit triggers
 * identify the authenticated PSE user directly over the `DATABASE_URL` URI connection.
 */
export async function withUserTransaction<TResult>(
  userId: string,
  fn: (client: PoolClient) => Promise<TResult>,
): Promise<TResult> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT set_config('request.jwt.claim.sub', $1, true),
              set_config('request.jwt.claims', json_build_object('sub', $1, 'role', 'authenticated')::text, true),
              set_config('app.current_user_id', $1, true)`,
      [userId],
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Server-side database client for module repositories (`repository.ts`).
 * Connects strictly via `DATABASE_URL`.
 */
export async function createSupabaseServerClient() {
  const pool = getDbPool();
  return {
    pool,
    query: <TRow extends QueryResultRow = QueryResultRow>(
      sql: string,
      params: unknown[] = [],
    ): Promise<QueryResult<TRow>> => queryDb<TRow>(sql, params),
    withUserTransaction,
  };
}
