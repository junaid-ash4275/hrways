#!/usr/bin/env node
import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@hrways.local';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123';
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'ADMIN')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email, hash]
  );
  console.log(`Seeded/updated admin user: ${email}`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await pool.end(); });

