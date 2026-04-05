import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import FriendRequest from '@/lib/models/FriendRequest';
import { sendPlainTextEmail } from '@/lib/email';
import crypto from 'crypto';

function getInviteBaseUrl(req: NextRequest) {
  const configured = process.env.INVITE_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '');

  return req.nextUrl.origin.replace(/\/$/, '');
}

async function sendInviteLinkEmail({
  receiverEmail,
  senderName,
  senderEmail,
  inviteUrl,
  balance,
  note,
}: {
  receiverEmail: string;
  senderName: string;
  senderEmail: string;
  inviteUrl: string;
  balance: number;
  note: string;
}) {
  const receiverName = receiverEmail.split('@')[0] || 'there';

  const balanceLine = balance > 0
    ? `Current balance note: You owe ${senderName} ₹${Math.abs(balance).toLocaleString('en-IN')}.`
    : balance < 0
      ? `Current balance note: ${senderName} owes you ₹${Math.abs(balance).toLocaleString('en-IN')}.`
      : 'Current balance note: You are all settled right now.';

  const noteLine = note ? `Note: ${note}` : '';

  const messageText = [
    `${senderName} (${senderEmail}) invited you to join PayMatrix.`,
    balanceLine,
    noteLine,
    `Accept invite: ${inviteUrl}`,
    'This invite link expires in 7 days.',
  ].filter(Boolean).join('\n\n');

  await sendPlainTextEmail({
    recipientEmail: receiverEmail,
    recipientName: receiverName,
    subject: `${senderName} invited you to join PayMatrix`,
    messageText,
  });
}

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

    // Reuse only this sender's existing pending invite for this recipient.
    // This keeps sender identity consistent and avoids leaking another sender's token/details.
    const existing = await FriendRequest.findOne({
      senderClerkId: userId,
      receiverEmail,
      status: 'pending',
    }).lean() as {
      token: string;
    } | null;

    const appUrl = getInviteBaseUrl(req);

    if (existing) {
      const updatedExisting = await FriendRequest.findOneAndUpdate(
        {
          senderClerkId: userId,
          receiverEmail,
          status: 'pending',
          token: existing.token,
        },
        {
          senderName,
          senderEmail,
          balance,
          note,
        },
        { new: true }
      ).lean() as { token: string; balance?: number; note?: string } | null;

      const inviteToken = updatedExisting?.token ?? existing.token;
      const inviteUrl = `${appUrl}/invite?token=${inviteToken}`;

      await sendInviteLinkEmail({
        receiverEmail,
        senderName,
        senderEmail,
        inviteUrl,
        balance: Number(updatedExisting?.balance ?? balance),
        note: String(updatedExisting?.note ?? note),
      });

      return NextResponse.json({
        success: true, inviteUrl, receiverEmail,
        message: `A pending invite already exists for ${receiverEmail}. The invite link was sent again by email.`,
      });
    }

    // Create new invite token (7-day expiry)
    const token     = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await FriendRequest.create({
      token, senderClerkId: userId, senderName, senderEmail,
      receiverEmail, balance, note, expiresAt,
    });

    const inviteUrl = `${appUrl}/invite?token=${token}`;

    await sendInviteLinkEmail({
      receiverEmail,
      senderName,
      senderEmail,
      inviteUrl,
      balance,
      note,
    });

    return NextResponse.json({
      success: true, inviteUrl, receiverEmail,
      message: `Invite sent to ${receiverEmail} via email 🎉`,
    });

  } catch (err: unknown) {
    console.error('INVITE ERROR:', err);
    const message = err instanceof Error ? err.message : 'Failed to send invite. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
