 import nodemailer from 'nodemailer';
import { z } from 'zod';

export const textEmailSchema = z.object({
  recipientEmail: z.string().trim().email('A valid recipient email is required'),
  recipientName: z.string().trim().min(1, 'Recipient name is required').max(120, 'Recipient name is too long'),
  subject: z.string().trim().min(1, 'Subject is required').max(140, 'Subject is too long'),
  messageText: z.string().trim().min(1, 'Message text is required').max(4000, 'Message is too long'),
});

export type TextEmailInput = z.infer<typeof textEmailSchema>;

const stripQuotes = (value: string) => value.replace(/^['"`]+|['"`]+$/g, '');
const stripZeroWidth = (value: string) => value.replace(/[\u200B-\u200D\uFEFF]/g, '');

function readEmailAuthConfig() {
  const gmailUser = stripQuotes(stripZeroWidth(process.env.GMAIL_USER?.trim() ?? ''));
  const smtpUser = stripQuotes(stripZeroWidth(process.env.SMTP_USER?.trim() ?? ''));
  const emailUser = stripQuotes(stripZeroWidth(process.env.EMAIL_USER?.trim() ?? ''));

  // Gmail App Password is always 16 letters. Remove spaces and any accidental punctuation/hidden chars.
  const gmailPassRaw = process.env.GMAIL_APP_PASSWORD ?? '';
  const gmailAppPassword = stripQuotes(stripZeroWidth(gmailPassRaw)).replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');

  // Generic SMTP passwords may contain symbols, so only trim/clean invisible chars.
  const smtpPass = stripQuotes(stripZeroWidth(process.env.SMTP_PASS ?? '')).trim();
  const emailPass = stripQuotes(stripZeroWidth(process.env.EMAIL_PASS ?? '')).trim();

  const user =
    gmailUser ||
    smtpUser ||
    emailUser;

  const pass =
    gmailAppPassword ||
    smtpPass ||
    emailPass;

  if (!user || !pass) {
    throw new Error(
      'Missing SMTP credentials. Set GMAIL_USER + GMAIL_APP_PASSWORD (or SMTP_USER + SMTP_PASS).',
    );
  }

  if (gmailUser && gmailAppPassword && gmailAppPassword.length !== 16) {
    throw new Error('Invalid GMAIL_APP_PASSWORD format. Use the 16-character Google App Password.');
  }

  return { user, pass };
}

function getGmailTransport() {
  const { user, pass } = readEmailAuthConfig();

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
    authMethod: 'LOGIN',
  });
}

export function buildPlainTextEmailBody({ recipientName, messageText }: Pick<TextEmailInput, 'recipientName' | 'messageText'>) {
  return `Hi ${recipientName},\n\n${messageText}\n\nBest regards,\n${process.env.EMAIL_SIGNATURE ?? 'PayMatrix'}`;
}

export async function sendPlainTextEmail(input: TextEmailInput) {
  const transporter = getGmailTransport();
  const { user: fromAddress } = readEmailAuthConfig();

  let info;
  try {
    info = await transporter.sendMail({
      from: `PayMatrix Mailer <${fromAddress}>`,
      to: input.recipientEmail,
      subject: input.subject,
      text: buildPlainTextEmailBody(input),
    });
  } catch (error: unknown) {
    const err = error as { code?: string; responseCode?: number; message?: string };
    const isAuthError = err?.code === 'EAUTH' || err?.responseCode === 535 || /BadCredentials/i.test(err?.message ?? '');

    if (isAuthError) {
      throw new Error(
        'Gmail login rejected (535). Use a Google App Password (not account password), keep 2-Step Verification enabled, and ensure the app password belongs to the same Gmail address in GMAIL_USER.',
      );
    }
    throw error;
  }

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}

export async function verifyGmailTransport() {
  const transporter = getGmailTransport();
  return transporter.verify();
}
