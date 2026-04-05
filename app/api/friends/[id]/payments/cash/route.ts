import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import Friendship from '@/lib/models/Friendship';
import PaymentTransaction from '@/lib/models/PaymentTransaction';

type Ctx = { params: Promise<{ id: string }> };

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const amount = Number(body.amount ?? 0);
    const city = String(body.city ?? '').trim().toLowerCase();
    const reminderAt = body.reminderAt ? new Date(body.reminderAt) : undefined;

    if (!(amount > 0)) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }
    if (!city) {
      return NextResponse.json({ error: 'City is required' }, { status: 400 });
    }

    await connectDB();

    const friendship = await Friendship.findById(id);
    if (!friendship) return NextResponse.json({ error: 'Friend not found' }, { status: 404 });

    const isA = friendship.userAClerkId === userId;
    const isB = friendship.userBClerkId === userId;
    if (!isA && !isB) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const balanceFromCurrentUser = Number(isA ? friendship.balance : -friendship.balance);
    if (!(balanceFromCurrentUser < 0)) {
      return NextResponse.json({ error: 'No payable amount for this friend.' }, { status: 400 });
    }

    const payableRemaining = round2(Math.abs(balanceFromCurrentUser));
    if (amount > payableRemaining) {
      return NextResponse.json({ error: `Amount exceeds remaining INR ${payableRemaining.toFixed(2)}` }, { status: 400 });
    }

    const from = userId;
    const to = isA ? friendship.userBClerkId : friendship.userAClerkId;

    const transaction = await PaymentTransaction.create({
      groupId: `friend:${id}`,
      from,
      to,
      amount,
      currency: 'INR',
      method: 'CASH',
      status: 'success',
      provider: 'OFFLINE_CASH',
      providerOrderId: uid('cash_ord'),
      providerTxnId: uid('cash_txn'),
      note: body.note ? String(body.note) : undefined,
      locationTag: {
        city: city || undefined,
      },
      reminderAt: reminderAt && !Number.isNaN(reminderAt.getTime()) ? reminderAt : undefined,
      reminderStatus: reminderAt && !Number.isNaN(reminderAt.getTime()) ? 'scheduled' : 'none',
      paidAt: new Date(),
      createdByClerkId: userId,
    });

    const after = round2(Math.min(0, balanceFromCurrentUser + amount));
    friendship.balance = isA ? after : -after;
    friendship.settled = Math.abs(after) === 0;
    friendship.settledAt = friendship.settled ? new Date() : null;
    friendship.lastUpdateType = friendship.settled ? 'settled' : 'balance_updated';
    friendship.lastUpdatedAt = new Date();
    friendship.unreadByA = isA ? false : true;
    friendship.unreadByB = isA ? true : false;
    await friendship.save();

    const remaining = round2(Math.abs(after));
    const paidAgg = await PaymentTransaction.aggregate([
      {
        $match: {
          groupId: `friend:${id}`,
          from: userId,
          status: 'success',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);
    const totalPaid = round2(Number(paidAgg[0]?.total ?? 0));

    return NextResponse.json({
      ok: true,
      transaction,
      remaining,
      totalPaid,
      totalPayableAmount: round2(totalPaid + remaining),
      friend: {
        id: friendship._id.toString(),
        balance: isA ? friendship.balance : -friendship.balance,
        settled: friendship.settled,
        settledAt: friendship.settledAt?.toISOString(),
        paymentStatus: friendship.settled ? 'done' : (Math.abs(Number((isA ? friendship.balance : -friendship.balance) ?? 0)) > 0 ? 'pending' : 'none'),
        paidAmount: totalPaid,
        remainingAmount: remaining,
        totalPayableAmount: round2(totalPaid + remaining),
        lastUpdateType: friendship.lastUpdateType,
        lastUpdatedAt: friendship.lastUpdatedAt?.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Friend Cash Payment Error:', error);
    return NextResponse.json({ error: 'Failed to save cash payment' }, { status: 500 });
  }
}