import nodemailer from 'nodemailer';
import { z } from 'zod';

export const textEmailSchema = z.object({
  recipientEmail: z.string().trim().email('A valid recipient email is required'),
  recipientName: z.string().trim().min(1, 'Recipient name is required').max(120, 'Recipient name is too long'),
  subject: z.string().trim().min(1, 'Subject is required').max(140, 'Subject is too long'),
  messageText: z.string().trim().min(1, 'Message text is required').max(4000, 'Message is too long'),
});

export type TextEmailInput = z.infer<typeof textEmailSchema>;

function getGmailTransport() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');

  if (!gmailUser || !gmailAppPassword) {
    throw new Error('Missing Gmail credentials. Set GMAIL_USER and GMAIL_APP_PASSWORD.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
}

export function buildPlainTextEmailBody({ recipientName, messageText }: Pick<TextEmailInput, 'recipientName' | 'messageText'>) {
  return `Hi ${recipientName},\n\n${messageText}\n\nBest regards,\n${process.env.EMAIL_SIGNATURE ?? 'PayMatrix'}`;
}

export async function sendPlainTextEmail(input: TextEmailInput) {
  const transporter = getGmailTransport();
  const fromAddress = process.env.GMAIL_USER as string;

  const info = await transporter.sendMail({
    from: `PayMatrix Mailer <${fromAddress}>`,
    to: input.recipientEmail,
    subject: input.subject,
    text: buildPlainTextEmailBody(input),
  });

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
