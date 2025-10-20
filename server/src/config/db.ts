import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({ connectionString: env.DATABASE_URL });

export async function pingDb(): Promise<boolean> {
  try {
    const r = await pool.query('SELECT 1');
    return r.rowCount === 1;
  } catch {
    return false;
  }
}

