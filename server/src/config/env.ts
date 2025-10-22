import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || '15m',
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL || '7d',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@hrways.local',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'ChangeMe123',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT || 0),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || 'HRWays <no-reply@local>',
  OTP_TTL_MIN: Number(process.env.OTP_TTL_MIN || 10),
  OTP_MAX_ATTEMPTS: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  RESET_TOKEN_TTL_MIN: Number(process.env.RESET_TOKEN_TTL_MIN || 15),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB || 5),
  ALLOWED_MIME: (process.env.ALLOWED_MIME || 'application/pdf,image/jpeg,image/png'),
  ORG_TZ_OFFSET: process.env.ORG_TZ_OFFSET || '+05:00'
};
