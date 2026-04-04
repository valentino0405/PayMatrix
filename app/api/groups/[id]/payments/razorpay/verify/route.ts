import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import PaymentTransaction from '@/lib/models/PaymentTransaction';
import SettlementRecord from '@/lib/models/SettlementRecord';
import crypto from 'crypto';

type Ctx = { params: Promise<{ id: string }> };

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transactionId, targetAmount } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !transactionId) {
      return NextResponse.json({ error: 'Missing Razorpay parameters' }, { status: 400 });
    }

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET!)
      .update(text)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return NextResponse.json({ error: 'Payment verification failed: Invalid signature' }, { status: 400 });
    }

    await connectDB();

    // Find the initiated transaction
    const transaction = await PaymentTransaction.findById(transactionId);
    if (!transaction || transaction.razorpayOrderId !== razorpay_order_id) {
      return NextResponse.json({ error: 'Transaction mismatch' }, { status: 404 });
    }

    if (transaction.status === 'success') {
      return NextResponse.json({ ok: true, message: 'Already processed' }, { status: 200 });
    }

    // Mark transaction as successful
    transaction.status = 'success';
    transaction.razorpayPaymentId = razorpay_payment_id;
    transaction.razorpaySignature = razorpay_signature;
    transaction.paidAt = new Date();
    await transaction.save();

    // Check existing paid amounts
    const from = transaction.from;
    const to = transaction.to;
    const amount = transaction.amount;
    
    let alreadyPaid = 0;
    let settlement = null;
    let totalPaid = amount;
    let remaining = 0;

    if (targetAmount != null && targetAmount > 0) {
      const paidAgg = await PaymentTransaction.aggregate([
        { $match: { groupId: id, from, to, status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      alreadyPaid = round2(Number(paidAgg[0]?.total ?? 0));
      
      // Calculate remaining after this transaction
      // alreadyPaid INCLUDES the current transaction because we just saved it and its status is 'success'
      remaining = round2(Math.max(0, targetAmount - alreadyPaid));

      if (remaining <= 0) {
        // Find if settlement already exists to prevent duplicate (in case of race conditions)
        const existingSettlement = await SettlementRecord.findOne({ groupId: id, from, to, amount: targetAmount });
        if (!existingSettlement) {
          settlement = await SettlementRecord.create({
            groupId: id,
            from,
            to,
            amount: targetAmount,
            paymentTransactionId: String(transaction._id),
            paidAt: transaction.paidAt,
          });
        }
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
      settlement,
      remaining,
    }, { status: 200 });

  } catch (error) {
    console.error('Razorpay Verify Error:', error);
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
}
