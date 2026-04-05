import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import Friendship from '@/lib/models/Friendship';
import FriendRequest from '@/lib/models/FriendRequest';
import PaymentTransaction from '@/lib/models/PaymentTransaction';

const round2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/friends — return all friends for the logged-in user
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    // All accepted friendships involving this user
    const friendships = await Friendship.find({
      $or: [{ userAClerkId: userId }, { userBClerkId: userId }],
    }).lean();

    // All pending invites sent by this user
    const pendingInvites = await FriendRequest.find({
      senderClerkId: userId,
      status: 'pending',
    }).lean();

    const friendGroupIds = friendships.map(f => `friend:${(f._id as { toString(): string }).toString()}`);
    const paidAgg = friendGroupIds.length
      ? await PaymentTransaction.aggregate([
          {
            $match: {
              groupId: { $in: friendGroupIds },
              status: 'success',
              from: userId,
            },
          },
          {
            $group: {
              _id: '$groupId',
              totalPaid: { $sum: '$amount' },
            },
          },
        ])
      : [];
    const paidByGroup = new Map<string, number>(
      paidAgg.map((row: { _id: string; totalPaid: number }) => [row._id, round2(Number(row.totalPaid ?? 0))])
    );

    // Transform friendships to a unified Friend shape from the current user's POV
    const friends = friendships.map(f => {
      const isA = f.userAClerkId === userId;
      const unread = Boolean(isA ? f.unreadByA : f.unreadByB);
      const paymentStatus = f.settled ? 'done' : (Math.abs(Number(f.balance ?? 0)) > 0 ? 'pending' : 'none');
      const friendId = (f._id as { toString(): string }).toString();
      const groupKey = `friend:${friendId}`;
      const perspectiveBalance = Number(isA ? f.balance : -f.balance);
      const remainingAmount = perspectiveBalance < 0 ? round2(Math.abs(perspectiveBalance)) : 0;
      const paidAmount = perspectiveBalance < 0 ? round2(paidByGroup.get(groupKey) ?? 0) : 0;
      const totalPayableAmount = perspectiveBalance < 0 ? round2(paidAmount + remainingAmount) : 0;
      return {
        id:       friendId,
        name:     isA ? f.userBName  : f.userAName,
        email:    isA ? f.userBEmail : f.userAEmail,
        avatar:   isA ? f.userBAvatar: f.userAAvatar,
        color:    isA ? f.colorB     : f.colorA,
        balance:  perspectiveBalance,   // positive = friend owes me
        note:     f.note ?? '',
        settled:  f.settled,
        settledAt:f.settledAt ? (f.settledAt as Date).toISOString() : undefined,
        unread,
        paymentStatus,
        paidAmount,
        remainingAmount,
        totalPayableAmount,
        lastUpdateType: f.lastUpdateType ?? 'created',
        lastUpdatedAt: (f.lastUpdatedAt as Date | undefined)?.toISOString() ?? (f.updatedAt as Date).toISOString(),
        status:   'accepted' as const,
        createdAt:(f.createdAt as Date).toISOString(),
      };
    });

    // Transform pending invites to Friend shape (pending status)
    const pending = pendingInvites.map(inv => ({
      id:       (inv._id as { toString(): string }).toString(),
      name:     inv.receiverEmail,   // don't know their name yet
      email:    inv.receiverEmail,
      avatar:   '',
      color:    '#6366f1',
      balance:  inv.balance,         // as set by sender
      note:     inv.note ?? '',
      settled:  false,
      settledAt:undefined,
      unread:   false,
      paymentStatus: 'none' as const,
      lastUpdateType: 'created' as const,
      lastUpdatedAt:(inv.updatedAt as Date).toISOString(),
      status:   'pending' as const,
      createdAt:(inv.createdAt as Date).toISOString(),
    }));

    return NextResponse.json([...friends, ...pending]);
  } catch (err) {
    console.error('GET FRIENDS ERROR:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
