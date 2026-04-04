import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import SettlementRecord from '@/lib/models/SettlementRecord';

type Ctx = { params: Promise<{ id: string }> };

// GET — fetch all paid settlements for a group
export async function GET(_: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await connectDB();
  const records = await SettlementRecord.find({ groupId: id }).sort({ paidAt: -1 }).lean();
  return NextResponse.json(records);
}

// POST — mark a settlement as paid
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  await connectDB();

  // Check if already settled (idempotent)
  const exists = await SettlementRecord.findOne({ groupId: id, from: body.from, to: body.to, amount: body.amount });
  if (exists) return NextResponse.json(exists);

  const record = await SettlementRecord.create({ groupId: id, from: body.from, to: body.to, amount: body.amount, paidAt: new Date() });
  return NextResponse.json(record, { status: 201 });
}

// DELETE — unmark a settlement (reverse payment)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  await connectDB();
  await SettlementRecord.deleteOne({ groupId: id, from: body.from, to: body.to, amount: body.amount });
  return NextResponse.json({ ok: true });
}
