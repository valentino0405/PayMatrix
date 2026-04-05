import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import Friendship from '@/lib/models/Friendship';
import PaymentTransaction from '@/lib/models/PaymentTransaction';
import crypto from 'crypto';

type Ctx = { params: Promise<{ id: string }> };

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transactionId } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !transactionId) {
      return NextResponse.json({ error: 'Missing Razorpay parameters' }, { status: 400 });
    }

    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET!)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Payment verification failed: Invalid signature' }, { status: 400 });
    }

    await connectDB();

    const friendship = await Friendship.findById(id);
    if (!friendship) return NextResponse.json({ error: 'Friend not found' }, { status: 404 });

    const isA = friendship.userAClerkId === userId;
    const isB = friendship.userBClerkId === userId;
    if (!isA && !isB) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const transaction = await PaymentTransaction.findById(transactionId);
    if (!transaction) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    if (
      transaction.groupId !== `friend:${id}` ||
      transaction.razorpayOrderId !== razorpay_order_id ||
      transaction.from !== userId
    ) {
      return NextResponse.json({ error: 'Transaction mismatch' }, { status: 400 });
    }

    if (transaction.status !== 'success') {
      transaction.status = 'success';
      transaction.razorpayPaymentId = razorpay_payment_id;
      transaction.razorpaySignature = razorpay_signature;
      transaction.paidAt = new Date();
      await transaction.save();
    }

    const before = Number(isA ? friendship.balance : -friendship.balance);
    if (!(before < 0)) {
      return NextResponse.json({
        ok: true,
        transaction,
        alreadySettled: true,
        remaining: 0,
      }, { status: 200 });
    }

    const applied = round2(Math.min(transaction.amount, Math.abs(before)));
    const after = round2(Math.min(0, before + applied));

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
    }, { status: 200 });
  } catch (error) {
    console.error('Friend Razorpay Verify Error:', error);
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
}
