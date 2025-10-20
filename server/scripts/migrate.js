#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensure() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

async function applied() {
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  return new Set(rows.map(r => r.name));
}

async function main() {
  await ensure();
  const dir = path.join(root, 'migrations');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort() : [];
  const done = await applied();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    console.log(`Applying ${f}...`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
      await pool.query('COMMIT');
      console.log(`✓ ${f}`);
    } catch (e) {
      await pool.query('ROLLBACK');
      console.error(`✗ Failed ${f}:`, e.message);
      throw e;
    }
  }
  await pool.end();
  console.log('Migrations complete.');
}

main().catch(async () => { await pool.end(); process.exitCode = 1; });

