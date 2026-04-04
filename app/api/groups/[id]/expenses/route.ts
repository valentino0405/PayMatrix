import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/groups/[id]/expenses
export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await connectDB();
    const expenses = await Expense.find({ groupId: id }).sort({ createdAt: -1 }).lean();
    return NextResponse.json(expenses);
  } catch (err) {
    console.error('GET expenses error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/groups/[id]/expenses
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;   // this is the groupId
    const body = await req.json();

    // Validate required fields
    if (!body.description?.trim()) return NextResponse.json({ error: 'description required' }, { status: 400 });
    if (!body.amount || body.amount <= 0) return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 });
    if (!body.paidBy) return NextResponse.json({ error: 'paidBy required' }, { status: 400 });
    if (!body.splitType) return NextResponse.json({ error: 'splitType required' }, { status: 400 });

    await connectDB();

    let isSuspicious = false;
    
    // Fraud Detection 1: Duplicates (same amount + description within last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const duplicate = await Expense.findOne({
      groupId: id,
      amount: Number(body.amount),
      description: body.description.trim(),
      createdAt: { $gte: oneDayAgo }
    });
    if (duplicate) isSuspicious = true;

    // Fraud Detection 2: Anomaly (amount > 10x average group expense)
    if (!isSuspicious) {
      const groupExpenses = await Expense.find({ groupId: id }).select('amount').lean();
      if (groupExpenses.length > 2) {
        const avg = groupExpenses.reduce((s, e) => s + e.amount, 0) / groupExpenses.length;
        if (Number(body.amount) > avg * 10) {
          isSuspicious = true;
        }
      }
    }

    const expense = await Expense.create({
      groupId:     id,             // always use the URL param, not request body
      description: body.description.trim(),
      amount:      Number(body.amount),
      paidBy:      body.paidBy,
      splitType:   body.splitType,
      splits:      Array.isArray(body.splits) ? body.splits : [],
      category:    body.category ?? 'Other',
      isSuspicious: isSuspicious,
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    console.error('POST expense error:', err);
    return NextResponse.json({ error: 'Server error', detail: String(err) }, { status: 500 });
  }
}
