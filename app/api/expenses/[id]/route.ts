import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/expenses/[id]
export async function DELETE(_: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await connectDB();
  await Expense.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
