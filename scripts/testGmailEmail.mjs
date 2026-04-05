import 'dotenv/config';
import nodemailer from 'nodemailer';

function getArg(index, fallback = '') {
  return (process.argv[index] ?? fallback).trim();
}

async function main() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, '');
  const recipientEmail = getArg(2);
  const recipientName = getArg(3, 'Friend');
  const subject = getArg(4, 'Test plain text email');
  const messageText = getArg(5, 'This is a test message sent from the command line.');

  if (!gmailUser || !gmailAppPassword) {
    throw new Error('Missing Gmail credentials. Set GMAIL_USER and GMAIL_APP_PASSWORD in your environment.');
  }

  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    throw new Error('Provide a valid recipient email as the first command-line argument.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  await transporter.verify();

  const info = await transporter.sendMail({
    from: `PayMatrix Mailer <${gmailUser}>`,
    to: recipientEmail,
    subject,
    text: `Hi ${recipientName},\n\n${messageText}\n\nBest regards,\nPayMatrix`,
  });

  console.log('Email sent successfully.');
  console.log(`Message ID: ${info.messageId}`);
  console.log(`Accepted: ${Array.isArray(info.accepted) ? info.accepted.join(', ') : info.accepted}`);
}

main().catch((error) => {
  console.error('GMAIL_TEST_ERROR:', error.message);
  process.exitCode = 1;
});
