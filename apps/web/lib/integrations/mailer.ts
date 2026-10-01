import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/lib/env';

let transport: Transporter | null = null;

/** SMTP Gmail (mot de passe d'application) : gratuit, 500 envois/jour. */
export async function sendMail(m: { to: string; subject: string; text: string; replyTo?: string; attachments?: { filename: string; content: Buffer }[] }) {
  if (!env.smtpUser || !env.smtpPass) return false;
  transport ??= nodemailer.createTransport({ service: 'gmail', auth: { user: env.smtpUser, pass: env.smtpPass } });
  await transport.sendMail({ from: `placeHolder <${env.smtpUser}>`, ...m });
  return true;
}
