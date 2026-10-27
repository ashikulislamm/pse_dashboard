import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl:
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // Ledger of applied migrations so each file runs once.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping (already applied): ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Applying migration: ${file}...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        ran += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    // Reference seed is idempotent (ON CONFLICT), so it is applied every run.
    const seedPath = path.resolve(process.cwd(), 'supabase', 'seed.sql');
    if (fs.existsSync(seedPath)) {
      console.log('Applying reference seed: supabase/seed.sql...');
      await client.query(fs.readFileSync(seedPath, 'utf8'));
    }

    console.log(`Done. ${ran} migration(s) applied, ${files.length - ran} already up to date.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Database migration failed:', err);
  process.exit(1);
});
