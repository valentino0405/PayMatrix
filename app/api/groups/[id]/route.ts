import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import Group from '@/lib/models/Group';
import Expense from '@/lib/models/Expense';
import SettlementRecord from '@/lib/models/SettlementRecord';
import PaymentTransaction from '@/lib/models/PaymentTransaction';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await connectDB();
  const group = await Group.findOne({ _id: id, ownerClerkId: userId }).lean();
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(group);
}

// PUT — update members (add/remove)
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  await connectDB();
  const group = await Group.findOneAndUpdate(
    { _id: id, ownerClerkId: userId },
    body,
    { returnDocument: 'after' }
  );
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(group);
}

// DELETE — remove group and all its expenses
export async function DELETE(_: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await connectDB();
  const deleted = await Group.findOneAndDelete({ _id: id, ownerClerkId: userId });
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await Promise.all([
    Expense.deleteMany({ groupId: id }),
    SettlementRecord.deleteMany({ groupId: id }),
    PaymentTransaction.deleteMany({ groupId: id }),
  ]);
  return NextResponse.json({ ok: true });
}

// PATCH — partial updates
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  await connectDB();
  const group = await Group.findOneAndUpdate(
    { _id: id, ownerClerkId: userId },
    { $set: body },
    { new: true }
  );
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(group);
}
