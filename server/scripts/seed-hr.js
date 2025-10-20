#!/usr/bin/env node
import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const email = 'hr@hrways.local';
  const password = 'ChangeMe123';
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'HR')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'HR'`,
    [email, hash]
  );
  console.log(`Seeded/updated HR user: ${email}`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await pool.end(); });

