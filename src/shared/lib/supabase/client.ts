/**
 * Browser-side placeholder: With URI-only PostgreSQL architecture (`DATABASE_URL`),
 * all database queries and auth operations execute on the server via Server Components
 * and Server Actions so database credentials never leave the server.
 */
export function createSupabaseBrowserClient(): never {
  throw new Error(
    'Direct browser DB connections are disabled. Use Server Components or Server Actions via DATABASE_URL.',
  );
}
