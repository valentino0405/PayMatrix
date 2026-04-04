import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import FriendRequest from '@/lib/models/FriendRequest';
import crypto from 'crypto';

// POST /api/friends/invite
export async function POST(req: NextRequest) {
  let receiverEmail = '';
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json();
    receiverEmail = (body.receiverEmail ?? '').toLowerCase().trim();
    const balance = Number(body.balance ?? 0);
    const note    = (body.note ?? '').trim();

    if (!receiverEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiverEmail)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    const senderEmail = clerkUser.emailAddresses[0]?.emailAddress ?? '';
    if (senderEmail.toLowerCase() === receiverEmail) {
      return NextResponse.json({ error: "You can't add yourself as a friend" }, { status: 400 });
    }

    const senderName = `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()
      || clerkUser.username
      || senderEmail;

    await connectDB();

    // Check for existing pending invite
    const existing = await FriendRequest.findOne({
      senderClerkId: userId,
      receiverEmail,
      status: 'pending',
    });
    if (existing) {
      // Re-use the existing token — just give back the link again
      const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const inviteUrl = `${appUrl}/invite?token=${existing.token}`;
      return NextResponse.json({
        success: true, inviteUrl, receiverEmail,
        message: `A pending invite already exists for ${receiverEmail}. Here's the link:`,
      });
    }

    // Create new invite token (7-day expiry)
    const token     = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await FriendRequest.create({
      token, senderClerkId: userId, senderName, senderEmail,
      receiverEmail, balance, note, expiresAt,
    });

    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteUrl = `${appUrl}/invite?token=${token}`;

    // Send invitation via Clerk's own email infrastructure
    // (no domain verification needed — works for any email)
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: receiverEmail,
      redirectUrl:  inviteUrl,
      notify:       true,
      publicMetadata: { inviteToken: token, senderName, balance, note },
    });

    return NextResponse.json({
      success: true, inviteUrl, receiverEmail,
      message: `Invite sent to ${receiverEmail} via email 🎉`,
    });

  } catch (err: unknown) {
    console.error('INVITE ERROR:', err);

    // Clerk throws a 422 when the email is already in Clerk (existing user).
    // The FriendRequest was already saved, so find it and return the invite URL.
    const message = (err as { message?: string; status?: number })?.message ?? '';
    const status  = (err as { status?: number })?.status ?? 0;

    if (status === 422 || message.toLowerCase().includes('already') || message.toLowerCase().includes('exist')) {
      await connectDB();
      const invite = await FriendRequest.findOne({
        receiverEmail, status: 'pending',
      }).sort({ createdAt: -1 }).lean() as { token: string } | null;

      const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const inviteUrl = invite ? `${appUrl}/invite?token=${(invite as { token: string }).token}` : appUrl;

      return NextResponse.json({
        success: true, inviteUrl, receiverEmail,
        message: `${receiverEmail} already has a PayMatrix account. Share this link with them directly:`,
        alreadyClerkUser: true,
      });
    }

    return NextResponse.json({ error: 'Failed to send invite. Please try again.' }, { status: 500 });
  }
}
