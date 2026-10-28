@AGENTS.md

# Claude Code notes

## Workflow
- Start a session by reading MEMORY.md (current phase and what exists), then the relevant phase in docs/08_Project_Management.md. Implement against its acceptance criteria.
- Next.js here is a newer version than your training data. Check `node_modules/next/dist/docs/` before using a Next API (caching, proxy/middleware, `revalidateTag` signatures, async `searchParams`/`cookies`).
- Match the surrounding module: copy the shape of `src/modules/meetings` (schema → service → repository → actions → queries → components) when adding a module or feature, including its `*.test.ts` and `loading.tsx`.
- When a phase finishes: run the full verification list from AGENTS.md, then update the Phase Tracker and "What exists" in MEMORY.md and note any new migration number.
- Do not commit or push unless asked. Don't leave scratch files in the repo; use the session scratchpad.

## Environment
- Windows 11. The Bash tool is Git Bash and PowerShell is also available; there is no `python`. Use `node -e` or the Edit tool for scripted edits.
- In Bash, backticks and `$` inside double-quoted `node -e` strings get expanded by the shell. For anything containing backticks (markdown, SQL template literals), write a file with Write/Edit instead of a heredoc one-liner.
- Standalone scripts outside the repo can't resolve `pg`; import it via `file:///D:/pse_dashboard/node_modules/pg/esm/index.mjs`.
- Scripts that need the database run with `node --env-file=.env ...` (the npm `db:*` scripts already do).

## Testing against the running app
- `npm run dev -p <port>` works for smoke tests. To call a protected page without logging in, sign an HS256 JWT cookie `pse_session` with `AUTH_SECRET` (payload: `sub`, `userId`, `email`, `role`, `iat`, `exp`) and pass it with `curl -b`.
- Server actions can't be driven with plain curl; verify their SQL path with a rolled-back transaction using `SET LOCAL ROLE authenticated` and `app.current_user_id`, as `scripts/db-tests.mjs` does.
- Stop any dev server you start before finishing.

## Review checklist before reporting done
1. Does the database enforce the rule, not just the UI?
2. Are authorisation and RLS exercised for member, target_manager, admin and non-PSE?
3. Are cache tags invalidated on every write that affects a dashboard figure?
4. Money via `<Money />`, dates via `<DateText />`, and no DESIGN.md bans?
5. Is there a loading state, an empty state and an error state?
6. Report what was actually run and its result; say plainly what was not tested.
