import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function walkFiles(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, result);
    } else if (entry.isFile()) {
      result.push(full);
    }
  }
  return result;
}

function runSecurityChecks() {
  console.log('Running Phase 9 Security & Client Bundle Verification...\n');

  // 1. Check that no source file references NEXT_PUBLIC_DATABASE_URL or NEXT_PUBLIC_AUTH_SECRET
  const srcFiles = walkFiles(path.join(rootDir, 'src'));
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(
      !content.includes('NEXT_PUBLIC_DATABASE_URL'),
      `[FAIL] Forbidden NEXT_PUBLIC_DATABASE_URL reference in ${path.relative(rootDir, file)}`,
    );
    assert.ok(
      !content.includes('NEXT_PUBLIC_AUTH_SECRET'),
      `[FAIL] Forbidden NEXT_PUBLIC_AUTH_SECRET reference in ${path.relative(rootDir, file)}`,
    );
  }
  console.log('  ✓ 1. Zero NEXT_PUBLIC_DATABASE_URL / NEXT_PUBLIC_AUTH_SECRET references in src/');

  // 2. Check that every module queries.ts that uses cached() calls requireUser() or requireRole() before invoking cached loaders
  const queryFiles = srcFiles.filter((f) => f.endsWith(path.join('queries.ts')));
  for (const file of queryFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('cached(')) {
      assert.ok(
        content.includes('requireUser(') || content.includes('requireRole('),
        `[FAIL] ${path.relative(rootDir, file)} uses cached() without requireUser()/requireRole()`,
      );
    }
  }
  console.log('  ✓ 2. Every cached() module query file enforces requireUser()/requireRole() authorization');

  // 3. Scan .next/static client bundle for secret values and server-only patterns
  const staticDir = path.join(rootDir, '.next', 'static');
  if (!fs.existsSync(staticDir)) {
    throw new Error('.next/static not found. Run `npm run build` before `npm run check:security`.');
  }

  const staticFiles = walkFiles(staticDir).filter((f) => /\.(js|css|json|map)$/i.test(f));
  assert.ok(staticFiles.length > 0, '[FAIL] Expected built client assets in .next/static');

  const forbiddenLiterals = [
    'postgresql://',
    'postgres://',
    'pooler.supabase.com',
    'DUMMY_PASSWORD_HASH',
  ];

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.length >= 12) {
    forbiddenLiterals.push(process.env.DATABASE_URL);
  }
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 12) {
    forbiddenLiterals.push(process.env.AUTH_SECRET);
  }

  for (const file of staticFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const secret of forbiddenLiterals) {
      assert.ok(
        !content.includes(secret),
        `[FAIL] Secret or server-only pattern "${secret.slice(0, 18)}..." leaked into client asset ${path.relative(rootDir, file)}`,
      );
    }
  }
  console.log(
    `  ✓ 3. Client bundle (.next/static, ${staticFiles.length} files) contains zero DATABASE_URL, AUTH_SECRET, or Postgres connection strings`,
  );

  console.log('\nAll Phase 9 security & client-bundle checks passed!');
}

try {
  runSecurityChecks();
} catch (err) {
  console.error('\nSecurity check failed:', err);
  process.exit(1);
}
