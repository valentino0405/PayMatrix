import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import Friendship from '@/lib/models/Friendship';

// PATCH /api/friends/[id] — update balance or settle
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    await connectDB();

    const friendship = await Friendship.findById(id);
    if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Verify the user is part of this friendship
    const isA = friendship.userAClerkId === userId;
    const isB = friendship.userBClerkId === userId;
    if (!isA && !isB) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if ('settled' in body) {
      if (body.settled) {
        friendship.settled = true;
        friendship.settledAt = new Date();
        friendship.balance = 0;
      } else {
        // Unsettle
        friendship.settled = false;
        friendship.settledAt = null;
      }
    }

    if ('balance' in body && !friendship.settled) {
      const newBalance = Number(body.balance);
      // balance from API is always from the current user's POV (positive = friend owes me)
      // In DB: balance = positive means B owes A
      friendship.balance = isA ? newBalance : -newBalance;
    }

    if ('note' in body) {
      friendship.note = body.note;
    }

    await friendship.save();

    // Return from current user's perspective
    return NextResponse.json({
      id:       friendship._id.toString(),
      balance:  isA ? friendship.balance : -friendship.balance,
      settled:  friendship.settled,
      settledAt:friendship.settledAt?.toISOString(),
      note:     friendship.note,
    });
  } catch (err) {
    console.error('PATCH FRIEND ERROR:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
