import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import PaymentTransaction from '@/lib/models/PaymentTransaction';
import Razorpay from 'razorpay';
import crypto from 'crypto';

type Ctx = { params: Promise<{ id: string }> };

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

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

    const from = String(body.from ?? '').trim();
    const to = String(body.to ?? '').trim();
    const amount = Number(body.amount ?? 0);
    const targetAmount = body.targetAmount == null ? null : Number(body.targetAmount);

    if (!from || !to || !(amount > 0)) {
      return NextResponse.json({ error: 'Invalid payment payload' }, { status: 400 });
    }

    await connectDB();

    // 1. Create Razorpay Order
    // Amount in Razorpay is always in paise (INR sub-units), so multiply by 100
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `rcpt_${uid('')}`,
      notes: {
        groupId: id,
        from,
        to,
      },
    });

    if (!rzpOrder || !rzpOrder.id) {
      throw new Error('Failed to create Razorpay Order');
    }

    // 2. Create PaymentTransaction in 'initiated' state
    const transaction = await PaymentTransaction.create({
      groupId: id,
      from,
      to,
      amount,
      currency: 'INR',
      method: 'RAZORPAY',
      status: 'initiated',
      provider: 'RAZORPAY',
      providerOrderId: uid('ord'), // Internal ID
      razorpayOrderId: rzpOrder.id,
      note: body.note ? String(body.note) : undefined,
      createdByClerkId: userId,
    });

    return NextResponse.json({
      ok: true,
      order: rzpOrder,
      transactionId: transaction._id,
      targetAmount,
    }, { status: 201 });

  } catch (error) {
    console.error('Razorpay Order Error:', error);
    return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 });
  }
}
