'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';

// Syncs Clerk user data into MongoDB directly (Server Action)
export async function syncUser() {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const clerkUser = await currentUser();
    if (!clerkUser) return { success: false, error: 'User not found in Clerk' };

    await connectDB();

    await User.findOneAndUpdate(
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

    return { success: true };
  } catch (err) {
    console.error('syncUser failed:', err);
    return { success: false, error: 'Server error' };
  }
}