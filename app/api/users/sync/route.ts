import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';

// POST /api/users/sync — upsert Clerk user into MongoDB
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await connectDB();

    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      {
        clerkId:   userId,
        email:     clerkUser.emailAddresses[0]?.emailAddress ?? '',
        name:      `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim(),
        username:  clerkUser.username ?? '',
        avatarUrl: clerkUser.imageUrl,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(user);
  } catch (err) {
    console.error('SYNC USER ERROR:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
