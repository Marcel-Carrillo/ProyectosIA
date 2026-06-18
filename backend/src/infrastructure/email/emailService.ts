import nodemailer from 'nodemailer';
import { logger } from '../logger';

let transporter: nodemailer.Transporter | null = null;

export function resetEmailTransporter(): void {
  transporter = null;
}

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const from = process.env.SMTP_FROM ?? 'noreply@example.com';
  try {
    await getTransporter().sendMail({
      from,
      to,
      subject: 'Password reset',
      text: `Reset your password: ${resetUrl}`,
      html: `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`,
    });
    logger.info('Password reset email sent', { to });
  } catch (err) {
    logger.warn('Password reset email failed', { to, err: String(err) });
    if (process.env.SMTP_STRICT === 'true') {
      throw err;
    }
  }
}
