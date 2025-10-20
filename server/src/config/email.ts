import nodemailer from 'nodemailer'
import { env } from './env'

export function createTransport() {
  if (!env.SMTP_HOST || !env.SMTP_PORT) {
    return null
  }
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })
  return transporter
}

export async function sendOtpEmail(to: string, otp: string) {
  const tx = createTransport()
  const subject = 'Your HRWays password reset code'
  const text = `Use this code to reset your password: ${otp}\nThis code expires in ${env.OTP_TTL_MIN} minutes.`
  const html = `<p>Use this code to reset your password:</p>
  <p style="font-size:20px;font-weight:700;letter-spacing:2px;">${otp}</p>
  <p>This code expires in ${env.OTP_TTL_MIN} minutes.</p>`
  if (!tx) {
    // Fallback: log to console in dev when SMTP not configured
    // eslint-disable-next-line no-console
    console.log(`[DEV] OTP for ${to}: ${otp}`)
    return
  }
  await tx.sendMail({ from: env.MAIL_FROM, to, subject, text, html })
}

