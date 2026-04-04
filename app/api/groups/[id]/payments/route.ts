import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import PaymentTransaction from '@/lib/models/PaymentTransaction';
import SettlementRecord from '@/lib/models/SettlementRecord';

type Ctx = { params: Promise<{ id: string }> };

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const status = req.nextUrl.searchParams.get('status');

  await connectDB();
  const query: Record<string, string> = { groupId: id };
  if (status) query.status = status;

  const rows = await PaymentTransaction.find(query).sort({ createdAt: -1 }).limit(100).lean();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const from = String(body.from ?? '').trim();
  const to = String(body.to ?? '').trim();
  const amount = Number(body.amount ?? 0);
  const targetAmount = body.targetAmount == null ? null : Number(body.targetAmount);

  if (!from || !to || !(amount > 0)) {
    return NextResponse.json({ error: 'Invalid payment payload' }, { status: 400 });
  }

  await connectDB();

  let alreadyPaid = 0;
  let remainingBefore: number | null = null;

  if (targetAmount != null && targetAmount > 0) {
    const existingSettlement = await SettlementRecord.findOne({ groupId: id, from, to, amount: targetAmount }).lean();
    if (existingSettlement) {
      return NextResponse.json({
        ok: true,
        status: 'success',
        alreadySettled: true,
        settlement: existingSettlement,
      });
    }

    const paidAgg = await PaymentTransaction.aggregate([
      { $match: { groupId: id, from, to, status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    alreadyPaid = round2(Number(paidAgg[0]?.total ?? 0));
    remainingBefore = round2(Math.max(0, targetAmount - alreadyPaid));

    if (remainingBefore <= 0) {
      return NextResponse.json({ error: 'This settlement is already fully paid.' }, { status: 400 });
    }
    if (amount > remainingBefore) {
      return NextResponse.json({ error: `Amount exceeds remaining ₹${remainingBefore.toFixed(2)}` }, { status: 400 });
    }
  }

  const reminderAt = body.reminderAt ? new Date(body.reminderAt) : undefined;
  if (reminderAt && !Number.isNaN(reminderAt.getTime()) && reminderAt.getTime() > Date.now()) {
    return NextResponse.json({ error: 'Future reminder dates are not allowed.' }, { status: 400 });
  }
  const transaction = await PaymentTransaction.create({
    groupId: id,
    from,
    to,
    amount,
    currency: 'INR',
    method: 'UPI_DEMO',
    status: 'processing',
    provider: 'SIMULATED_UPI',
    providerOrderId: uid('ord'),
    note: body.note ? String(body.note) : undefined,
    locationTag: {
      label: body.locationLabel ? String(body.locationLabel) : undefined,
      city: body.city ? String(body.city) : undefined,
      lat: typeof body.lat === 'number' ? body.lat : undefined,
      lng: typeof body.lng === 'number' ? body.lng : undefined,
    },
    reminderAt: reminderAt && !Number.isNaN(reminderAt.getTime()) ? reminderAt : undefined,
    reminderStatus: reminderAt && !Number.isNaN(reminderAt.getTime()) ? 'scheduled' : 'none',
    createdByClerkId: userId,
  });

  const isSuccess = true;

  if (!isSuccess) {
    transaction.status = 'failed';
    transaction.failureReason = 'Simulated UPI timeout';
    await transaction.save();
    return NextResponse.json({ ok: false, status: 'failed', transaction });
  }

  transaction.status = 'success';
  transaction.providerTxnId = uid('txn');
  transaction.paidAt = new Date();
  await transaction.save();

  let settlement = null;
  let totalPaid = amount;
  let remaining = 0;

  if (targetAmount != null && targetAmount > 0) {
    totalPaid = round2(alreadyPaid + amount);
    remaining = round2(Math.max(0, targetAmount - totalPaid));

    if (remaining <= 0) {
      settlement = await SettlementRecord.create({
        groupId: id,
        from,
        to,
        amount: targetAmount,
        paymentTransactionId: String(transaction._id),
        paidAt: transaction.paidAt,
      });
    }
  } else {
    settlement = await SettlementRecord.create({
      groupId: id,
      from,
      to,
      amount,
      paymentTransactionId: String(transaction._id),
      paidAt: transaction.paidAt,
    });
  }

  return NextResponse.json({
    ok: true,
    status: 'success',
    transaction,
    targetAmount,
    totalPaid,
    remaining,
    settlement,
  }, { status: 201 });
}
