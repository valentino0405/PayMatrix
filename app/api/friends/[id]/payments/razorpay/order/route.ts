import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import Friendship from '@/lib/models/Friendship';
import PaymentTransaction from '@/lib/models/PaymentTransaction';
import Razorpay from 'razorpay';

type Ctx = { params: Promise<{ id: string }> };

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_SECRET!,
});

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const amount = Number(body.amount ?? 0);
    const targetAmount = body.targetAmount == null ? null : Number(body.targetAmount);
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
    const effectiveTarget = targetAmount != null && targetAmount > 0
      ? round2(Math.min(targetAmount, payableRemaining))
      : payableRemaining;

    if (amount > effectiveTarget) {
      return NextResponse.json({ error: `Amount exceeds remaining INR ${effectiveTarget.toFixed(2)}` }, { status: 400 });
    }

    const from = userId;
    const to = isA ? friendship.userBClerkId : friendship.userAClerkId;

    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `frnd_${uid('')}`,
      notes: {
        friendId: id,
        from,
        to,
      },
    });

    if (!rzpOrder?.id) {
      throw new Error('Failed to create Razorpay order');
    }

    const transaction = await PaymentTransaction.create({
      groupId: `friend:${id}`,
      from,
      to,
      amount,
      currency: 'INR',
      method: 'RAZORPAY',
      status: 'initiated',
      provider: 'RAZORPAY',
      providerOrderId: uid('ord'),
      razorpayOrderId: rzpOrder.id,
      note: body.note ? String(body.note) : undefined,
      locationTag: {
        city: city || undefined,
      },
      reminderAt: reminderAt && !Number.isNaN(reminderAt.getTime()) ? reminderAt : undefined,
      reminderStatus: reminderAt && !Number.isNaN(reminderAt.getTime()) ? 'scheduled' : 'none',
      createdByClerkId: userId,
    });

    return NextResponse.json({
      ok: true,
      order: rzpOrder,
      transactionId: transaction._id,
      targetAmount: effectiveTarget,
      remaining: payableRemaining,
    }, { status: 201 });
  } catch (error) {
    console.error('Friend Razorpay Order Error:', error);
    return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 });
  }
}
