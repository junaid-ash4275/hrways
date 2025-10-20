import { Router } from 'express';
import { pingDb, pool } from './config/db';
import bcrypt from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { env } from './config/env';
import { authGuard } from './middleware/authGuard';
import { randomUUID, randomInt } from 'crypto';
import { sendOtpEmail } from './config/email';

export const routes = Router();

routes.get('/healthz', async (_req, res) => {
  const db = await pingDb();
  res.json({ ok: true, db });
});

// HRW-AUTH-1: Login Endpoint & Flow
routes.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email and password are required' } });
    }
    const { rows } = await pool.query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    const signCompat = sign as unknown as (p: any, s: any, o?: any) => string;
    const access = signCompat({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL });
    const jti = randomUUID();
    const refresh = signCompat({ sub: user.id, jti }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL });
    const ttlSec = ttlToSeconds(env.JWT_REFRESH_TTL);
    const exp = new Date(Date.now() + ttlSec * 1000);
    await pool.query('INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3)', [jti, user.id, exp.toISOString()]);
    return res.json({ accessToken: access, refreshToken: refresh });
  } catch (e) {
    next(e);
  }
});

// HRW-RESET-1: Request password reset (OTP)
routes.post('/auth/request-reset', async (req, res, next) => {
  try {
    const email = (req.body?.email || '').toString().trim().toLowerCase()
    // Always 202 to avoid user enumeration
    res.status(202).json({ ok: true })
    if (!email) return
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (rows.length === 0) return
    const userId = rows[0].id as string
    // Generate 6-digit OTP
    const n = randomInt(0, 1000000)
    const otp = n.toString().padStart(6, '0')
    const hash = await bcrypt.hash(otp, 10)
    const exp = new Date(Date.now() + env.OTP_TTL_MIN * 60 * 1000)
    await pool.query(
      `INSERT INTO password_reset_requests (user_id, hashed_otp, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, hash, exp.toISOString()]
    )
    // Send the OTP email (or console log if SMTP not set)
    await sendOtpEmail(email, otp)
  } catch (e) {
    next(e)
  }
})

function ttlToSeconds(ttl: string): number {
  const m = /^([0-9]+)([smhd])$/.exec(ttl.trim());
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2];
  switch (unit) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: return 0;
  }
}

// HRW-AUTH-3: Refresh & Logout
routes.post('/auth/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'refreshToken is required' } });
    }
    let payload: any;
    try {
      payload = verify(refreshToken, env.JWT_REFRESH_SECRET) as any;
    } catch {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' } });
    }
    const jti = payload.jti as string | undefined;
    const userId = payload.sub as string | undefined;
    if (!jti || !userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Malformed refresh token' } });
    }
    const { rows } = await pool.query('SELECT revoked_at, expires_at FROM refresh_tokens WHERE jti = $1 AND user_id = $2', [jti, userId]);
    if (rows.length === 0) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Refresh token not recognized' } });
    }
    const row = rows[0];
    if (row.revoked_at || new Date(row.expires_at) < new Date()) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Refresh token is revoked or expired' } });
    }
    // Rotation: revoke old and issue new
    await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE jti = $1', [jti]);
    const newJti = randomUUID();
    // Load current role to embed in access token
    const userRow = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    const role = userRow.rows?.[0]?.role;
    const signCompat = sign as unknown as (p: any, s: any, o?: any) => string;
    const access = signCompat({ sub: userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL });
    const refresh = signCompat({ sub: userId, jti: newJti }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL });
    const ttlSec = ttlToSeconds(env.JWT_REFRESH_TTL);
    const exp = new Date(Date.now() + ttlSec * 1000);
    await pool.query('INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3)', [newJti, userId, exp.toISOString()]);
    return res.json({ accessToken: access, refreshToken: refresh });
  } catch (e) {
    next(e);
  }
});

routes.post('/auth/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'refreshToken is required' } });
    }
    let payload: any;
    try {
      payload = verify(refreshToken, env.JWT_REFRESH_SECRET) as any;
    } catch {
      // Logout should be idempotent; respond 200 even if invalid
      return res.json({ ok: true });
    }
    const jti = payload.jti as string | undefined;
    const userId = payload.sub as string | undefined;
    if (!jti || !userId) return res.json({ ok: true });
    await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE jti = $1 AND user_id = $2', [jti, userId]);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// HRW-RESET-2: Verify OTP -> reset token
routes.post('/auth/verify-reset-otp', async (req, res, next) => {
  try {
    const email = (req.body?.email || '').toString().trim().toLowerCase()
    const otp = (req.body?.otp || '').toString().trim()
    if (!email || !otp) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email and otp are required' } })
    }
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: { code: 'INVALID_OTP', message: 'Invalid code' } })
    }
    const userId = userRes.rows[0].id as string
    const reqRes = await pool.query(
      `SELECT * FROM password_reset_requests
       WHERE user_id = $1 AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    )
    if (reqRes.rows.length === 0) {
      return res.status(400).json({ error: { code: 'INVALID_OTP', message: 'Invalid code' } })
    }
    const pr = reqRes.rows[0]
    const now = new Date()
    if (new Date(pr.expires_at) < now) {
      return res.status(401).json({ error: { code: 'OTP_EXPIRED', message: 'Code expired' } })
    }
    if (pr.attempts >= env.OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: { code: 'OTP_LOCKED', message: 'Too many attempts. Try again later.' } })
    }
    const ok = await bcrypt.compare(otp, pr.hashed_otp)
    if (!ok) {
      await pool.query('UPDATE password_reset_requests SET attempts = attempts + 1 WHERE id = $1', [pr.id])
      const attempts = pr.attempts + 1
      if (attempts >= env.OTP_MAX_ATTEMPTS) {
        return res.status(429).json({ error: { code: 'OTP_LOCKED', message: 'Too many attempts. Try again later.' } })
      }
      return res.status(401).json({ error: { code: 'INVALID_OTP', message: 'Invalid code' } })
    }
    // Mark request used and create reset token
    await pool.query('UPDATE password_reset_requests SET used_at = now() WHERE id = $1', [pr.id])
    const tokenId = randomUUID()
    const secret = randomUUID().replace(/-/g, '')
    const tokenHash = await bcrypt.hash(secret, 10)
    const ttlMs = env.RESET_TOKEN_TTL_MIN * 60 * 1000
    const exp = new Date(Date.now() + ttlMs)
    await pool.query(
      `INSERT INTO password_reset_tokens (id, user_id, request_id, hashed_token, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenId, userId, pr.id, tokenHash, exp.toISOString()]
    )
    const resetToken = `${tokenId}.${secret}`
    return res.json({ resetToken, expiresAt: exp.toISOString() })
  } catch (e) {
    next(e)
  }
})

// HRW-RESET-3: Reset password
routes.post('/auth/reset', async (req, res, next) => {
  try {
    const resetToken = (req.body?.resetToken || '').toString().trim()
    const newPassword = (req.body?.newPassword || '').toString()
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'resetToken and newPassword are required' } })
    }
    // Password policy: min 8, upper, lower, digit
    const policy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!policy.test(newPassword)) {
      return res.status(400).json({ error: { code: 'PASSWORD_WEAK', message: 'Password must be 8+ chars with upper, lower, digit' } })
    }
    const parts = resetToken.split('.')
    if (parts.length !== 2) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid reset token' } })
    }
    const [tokenId, secret] = parts
    const tRes = await pool.query('SELECT * FROM password_reset_tokens WHERE id = $1', [tokenId])
    if (tRes.rows.length === 0) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid reset token' } })
    }
    const t = tRes.rows[0]
    if (t.used_at || new Date(t.expires_at) < new Date()) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token expired or used' } })
    }
    const ok = await bcrypt.compare(secret, t.hashed_token)
    if (!ok) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid reset token' } })
    }
    const hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, t.user_id])
    await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [tokenId])
    return res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})
// Example protected routes to validate HRW-AUTH-2
routes.get('/me', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No user in context' } });
    const { rows } = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Preferences (theme, locale, timezone)
routes.get('/me/preferences', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const { rows } = await pool.query('SELECT preferences FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } });
    res.json(rows[0].preferences || {});
  } catch (e) {
    next(e);
  }
});

routes.put('/me/preferences', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const prefs = req.body || {};
    if (prefs.theme && !['light', 'dark'].includes(prefs.theme)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'theme must be light or dark' } });
    }
    const merged = await pool.query(
      `UPDATE users
         SET preferences = COALESCE(preferences, '{}'::jsonb) || $2::jsonb
       WHERE id = $1
       RETURNING preferences`,
      [userId, JSON.stringify(prefs)]
    );
    res.json(merged.rows[0].preferences || {});
  } catch (e) {
    next(e);
  }
});

// HRW-SET-1: Profile view/update
// Allowed profile fields: fullName, phone, title (all optional strings)
routes.get('/me/profile', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const { rows } = await pool.query('SELECT profile FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } });
    res.json(rows[0].profile || {});
  } catch (e) {
    next(e);
  }
});

routes.put('/me/profile', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const body = req.body || {};
    const out: any = {};
    const errors: string[] = [];

    function takeStr(key: string, max: number, pattern?: RegExp, msg?: string) {
      if (body[key] === undefined) return;
      const v = String(body[key]).trim();
      if (!v) { out[key] = ''; return; }
      if (v.length > max) errors.push(`${key} too long (max ${max})`);
      if (pattern && !pattern.test(v)) errors.push(msg || `${key} invalid format`);
      out[key] = v;
    }

    takeStr('fullName', 100);
    // Phone: allow digits, spaces, +, -, parentheses
    takeStr('phone', 30, /^[0-9+\-()\s]{6,}$/,
      'phone must contain at least 6 valid characters (digits, space, +, -, ())');
    takeStr('title', 60);

    if (errors.length) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid profile data', details: errors } });
    }

    const merged = await pool.query(
      `UPDATE users
         SET profile = COALESCE(profile, '{}'::jsonb) || $2::jsonb
       WHERE id = $1
       RETURNING profile`,
      [userId, JSON.stringify(out)]
    );
    res.json(merged.rows[0].profile || {});
  } catch (e) {
    next(e);
  }
});

routes.get('/admin/ping', authGuard('ADMIN'), (_req, res) => {
  res.json({ ok: true, scope: 'ADMIN' });
});

// Settings: change password (authenticated)
routes.post('/me/change-password', authGuard(), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id
    const { currentPassword, newPassword } = req.body || {}
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'currentPassword and newPassword are required' } })
    }
    const policy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!policy.test(newPassword)) {
      return res.status(400).json({ error: { code: 'PASSWORD_WEAK', message: 'Password must be 8+ chars with upper, lower, digit' } })
    }
    const row = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId])
    if (row.rows.length === 0) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } })
    }
    const ok = await bcrypt.compare(currentPassword, row.rows[0].password_hash)
    if (!ok) {
      return res.status(400).json({ error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } })
    }
    const hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId])
    return res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})
