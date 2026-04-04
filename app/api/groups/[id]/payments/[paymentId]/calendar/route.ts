import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import PaymentTransaction from '@/lib/models/PaymentTransaction';

type Ctx = { params: Promise<{ id: string; paymentId: string }> };

const toIcsDate = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

export async function GET(_: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { id, paymentId } = await params;
  await connectDB();

  const payment = await PaymentTransaction.findOne({ _id: paymentId, groupId: id }).lean();
  if (!payment) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  const start = payment.reminderAt ? new Date(payment.reminderAt) : new Date(Date.now() + 15 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const summary = `Payment reminder: INR ${payment.amount}`;
  const description = `Demo UPI reminder for group ${id}. ${payment.from} pays ${payment.to}.`;
  const location = payment.locationTag?.label || payment.locationTag?.city || 'PayMatrix';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PayMatrix//Payment Reminder//EN',
    'BEGIN:VEVENT',
    `UID:${payment._id}@paymatrix.local`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="payment-reminder-${payment._id}.ics"`,
    },
  });
}
