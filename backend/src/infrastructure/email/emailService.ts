import nodemailer from 'nodemailer';
import { logger } from '../logger';
import { buildPasswordResetEmail } from './templates/passwordResetEmail';
import { MAVILE_ICON_DATA_URI } from './mavileIconEmbedded';

const LOGO_ATTACHMENT = {
  filename: 'mavile-icon.png',
  content: Buffer.from(MAVILE_ICON_DATA_URI.replace(/^data:image\/png;base64,/, ''), 'base64'),
  cid: 'mavile-icon',
};

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
  const { subject, text, html } = buildPasswordResetEmail(resetUrl);
  try {
    await getTransporter().sendMail({
      from,
      to,
      subject,
      text,
      html,
      attachments: [LOGO_ATTACHMENT],
    });
    logger.info('Password reset email sent', { to });
  } catch (err) {
    logger.warn('Password reset email failed', { to, err: String(err) });
    if (process.env.SMTP_STRICT === 'true') {
      throw err;
    }
  }
}

export async function sendContactEmail(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<void> {
  const from = process.env.SMTP_FROM ?? 'noreply@example.com';
  const to = process.env.SMTP_FROM ?? 'noreply@example.com';
  const { name, email, subject, message } = data;
  try {
    await getTransporter().sendMail({
      from,
      to,
      replyTo: `${name} <${email}>`,
      subject: `[Contacto Mavile] ${subject}`,
      text: `Nombre: ${name}\nEmail: ${email}\n\n${message}`,
      html: `<p><strong>Nombre:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p>${message.replace(/\n/g, '<br>')}</p>`,
    });
    logger.info('Contact email sent', { from: email });
  } catch (err) {
    logger.warn('Contact email failed', { err: String(err) });
    if (process.env.SMTP_STRICT === 'true') {
      throw err;
    }
  }
}

export async function sendWelcomeEmail(
  to: string,
  content: { subject: string; html: string; text: string }
): Promise<void> {
  const from = process.env.SMTP_FROM ?? 'noreply@example.com';
  try {
    await getTransporter().sendMail({
      from,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
      attachments: [LOGO_ATTACHMENT],
    });
    logger.info('Welcome email sent', { to });
  } catch (err) {
    logger.warn('Welcome email failed', { to, err: String(err) });
    if (process.env.SMTP_STRICT === 'true') {
      throw err;
    }
  }
}
