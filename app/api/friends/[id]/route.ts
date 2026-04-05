import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import Friendship from '@/lib/models/Friendship';
import FriendRequest from '@/lib/models/FriendRequest';

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

    if (body.markRead === true) {
      if (isA) friendship.unreadByA = false;
      if (isB) friendship.unreadByB = false;
      await friendship.save();

      return NextResponse.json({
        id: friendship._id.toString(),
        unread: isA ? friendship.unreadByA : friendship.unreadByB,
      });
    }

    let changed = false;

    if ('settled' in body) {
      if (body.settled) {
        friendship.settled = true;
        friendship.settledAt = new Date();
        friendship.balance = 0;
        friendship.lastUpdateType = 'settled';
        changed = true;
      } else {
        // Unsettle
        friendship.settled = false;
        friendship.settledAt = null;
        friendship.lastUpdateType = 'unsettled';
        changed = true;
      }
    }

    if ('balance' in body && !friendship.settled) {
      const newBalance = Number(body.balance);
      // balance from API is always from the current user's POV (positive = friend owes me)
      // In DB: balance = positive means B owes A
      friendship.balance = isA ? newBalance : -newBalance;
      friendship.lastUpdateType = 'balance_updated';
      changed = true;
    }

    if ('note' in body) {
      friendship.note = body.note;
      friendship.lastUpdateType = 'note_updated';
      changed = true;
    }

    if (changed) {
      friendship.lastUpdatedAt = new Date();
      friendship.unreadByA = isA ? false : true;
      friendship.unreadByB = isB ? false : true;
    }

    await friendship.save();

    // Return from current user's perspective
    return NextResponse.json({
      id:       friendship._id.toString(),
      balance:  isA ? friendship.balance : -friendship.balance,
      settled:  friendship.settled,
      settledAt:friendship.settledAt?.toISOString(),
      note:     friendship.note,
      unread:   isA ? friendship.unreadByA : friendship.unreadByB,
      paymentStatus: friendship.settled ? 'done' : (Math.abs(Number(friendship.balance ?? 0)) > 0 ? 'pending' : 'none'),
      lastUpdateType: friendship.lastUpdateType,
      lastUpdatedAt: friendship.lastUpdatedAt?.toISOString(),
    });
  } catch (err) {
    console.error('PATCH FRIEND ERROR:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/friends/[id] — remove friend (accepted) or cancel pending invite
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await connectDB();

    // First, try accepted friendship deletion.
    const friendship = await Friendship.findById(id);
    if (friendship) {
      const isA = friendship.userAClerkId === userId;
      const isB = friendship.userBClerkId === userId;
      if (!isA && !isB) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      await friendship.deleteOne();
      return NextResponse.json({ ok: true, kind: 'accepted' });
    }

    // If not an accepted friendship, allow sender to cancel pending invite.
    const pendingInvite = await FriendRequest.findById(id);
    if (!pendingInvite) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (pendingInvite.senderClerkId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await pendingInvite.deleteOne();
    return NextResponse.json({ ok: true, kind: 'pending' });
  } catch (err) {
    console.error('DELETE FRIEND ERROR:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
