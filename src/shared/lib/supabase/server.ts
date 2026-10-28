import 'server-only';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDbPool, queryDb } from './admin';

/**
 * Runs `fn` in a transaction as the given user: sets role `authenticated` and the user id,
 * so Postgres RLS and the audit triggers apply.
 */
export async function withUserTransaction<TResult>(
  userId: string,
  fn: (client: PoolClient) => Promise<TResult>,
): Promise<TResult> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
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

/** Db client for module repositories (`DATABASE_URL`). */
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
