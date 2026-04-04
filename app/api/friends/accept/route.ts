import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import FriendRequest from '@/lib/models/FriendRequest';
import Friendship from '@/lib/models/Friendship';

const MEMBER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316'];
const randColor = () => MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];

// POST /api/friends/accept
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    await connectDB();

    const invite = await FriendRequest.findOne({ token });
    if (!invite) return NextResponse.json({ error: 'Invite not found or already used' }, { status: 404 });
    if (invite.status === 'accepted') return NextResponse.json({ error: 'This invite has already been accepted', alreadyAccepted: true }, { status: 409 });
    if (invite.status === 'expired' || invite.expiresAt < new Date()) {
      await FriendRequest.findByIdAndUpdate(invite._id, { status: 'expired' });
      return NextResponse.json({ error: 'This invite link has expired' }, { status: 410 });
    }
    if (invite.senderClerkId === userId) {
      return NextResponse.json({ error: "You can't accept your own invite" }, { status: 400 });
    }

    // Check if friendship already exists
    const existingFriendship = await Friendship.findOne({
      $or: [
        { userAClerkId: invite.senderClerkId, userBClerkId: userId },
        { userAClerkId: userId, userBClerkId: invite.senderClerkId },
      ],
    });
    if (existingFriendship) {
      await FriendRequest.findByIdAndUpdate(invite._id, { status: 'accepted' });
      return NextResponse.json({ success: true, alreadyFriends: true });
    }

    const receiverName = `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()
      || clerkUser.username
      || clerkUser.emailAddresses[0]?.emailAddress
      || 'Unknown';
    const receiverEmail = clerkUser.emailAddresses[0]?.emailAddress ?? '';
    const receiverAvatar = clerkUser.imageUrl ?? '';

    // Create the friendship — balance is from A's perspective (positive = B owes A)
    const friendship = await Friendship.create({
      userAClerkId: invite.senderClerkId,
      userBClerkId: userId,
      userAName:    invite.senderName,
      userBName:    receiverName,
      userAEmail:   invite.senderEmail,
      userBEmail:   receiverEmail,
      userAAvatar:  '',
      userBAvatar:  receiverAvatar,
      colorA:       randColor(),
      colorB:       randColor(),
      balance:      invite.balance,   // positive = B (receiver) owes A (sender)
      note:         invite.note,
      settled:      invite.balance === 0,
    });

    // Mark invite as accepted
    await FriendRequest.findByIdAndUpdate(invite._id, { status: 'accepted' });

    return NextResponse.json({ success: true, friendship });
  } catch (err) {
    console.error('ACCEPT ERROR:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
