import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import PaymentTransaction from '@/lib/models/PaymentTransaction';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const dueBeforeRaw = req.nextUrl.searchParams.get('dueBefore');
  const dueBefore = dueBeforeRaw ? new Date(dueBeforeRaw) : new Date();

  await connectDB();

  const reminders = await PaymentTransaction.find({
    groupId: id,
    reminderStatus: 'scheduled',
    reminderAt: { $lte: dueBefore },
  })
    .sort({ reminderAt: 1 })
    .lean();

  return NextResponse.json(reminders);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const limitRaw = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(Math.max(Number(limitRaw ?? 20), 1), 100);

  await connectDB();

  const due = await PaymentTransaction.find({
    groupId: id,
    reminderStatus: 'scheduled',
    reminderAt: { $lte: new Date() },
  })
    .sort({ reminderAt: 1 })
    .limit(limit)
    .lean();

  if (due.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, payload: [] });
  }

  const ids = due.map(d => d._id);
  await PaymentTransaction.updateMany(
    { _id: { $in: ids } },
    { $set: { reminderStatus: 'sent' } }
  );

  const payload = due.map(d => ({
    paymentId: d._id,
    groupId: d.groupId,
    from: d.from,
    to: d.to,
    amount: d.amount,
    reminderAt: d.reminderAt,
    locationLabel: d.locationTag?.label,
    city: d.locationTag?.city,
    note: d.note,
    channel: 'in-app-demo',
  }));

  return NextResponse.json({ ok: true, processed: payload.length, payload });
}
