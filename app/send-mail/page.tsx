import type { Metadata } from 'next';
import TextMailForm from '@/components/TextMailForm';

export const metadata: Metadata = {
  title: 'Send Mail — PayMatrix',
  description: 'Send plain text emails with Gmail and Nodemailer.',
};

export default function SendMailPage() {
  return <TextMailForm />;
}
