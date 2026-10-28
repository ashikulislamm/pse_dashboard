/** Browser access is disabled: the database is only reached from the server, so credentials never leave it. */
export function createSupabaseBrowserClient(): never {
  throw new Error(
    'Direct browser DB connections are disabled. Use Server Components or Server Actions via DATABASE_URL.',
  );
}
