import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/groups/[id]/expenses
export async function GET(_: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await connectDB();
  const expenses = await Expense.find({ groupId: id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(expenses);
}

// POST /api/groups/[id]/expenses
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  await connectDB();
  const expense = await Expense.create({ ...body, groupId: id });
  return NextResponse.json(expense, { status: 201 });
}
