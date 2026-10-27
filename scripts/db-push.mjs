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
    const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Applying migration: ${file}...`);
      await client.query(sql);
    }

    const seedPath = path.resolve(process.cwd(), 'supabase', 'seed.sql');
    if (fs.existsSync(seedPath)) {
      console.log('Applying reference seed: supabase/seed.sql...');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await client.query(seedSql);
    }

    console.log('All migrations and reference seeds applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Database migration failed:', err);
  process.exit(1);
});
