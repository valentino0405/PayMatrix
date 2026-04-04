import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

interface SendInviteEmailParams {
  senderName: string;
  senderEmail: string;
  receiverEmail: string;
  token: string;
  balance: number;        // positive = receiver owes sender
  note?: string;
}

export async function sendFriendInviteEmail({
  senderName,
  senderEmail,
  receiverEmail,
  token,
  balance,
  note,
}: SendInviteEmailParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const inviteUrl = `${appUrl}/invite?token=${token}`;

  let balanceText = '';
  if (balance > 0) {
    balanceText = `<p style="margin:0;font-size:14px;color:#94a3b8;">They've noted that you owe <strong style="color:#f87171;">₹${Math.abs(balance).toLocaleString('en-IN')}</strong> — you can settle up once you join!</p>`;
  } else if (balance < 0) {
    balanceText = `<p style="margin:0;font-size:14px;color:#94a3b8;">They've noted that they owe you <strong style="color:#34d399;">₹${Math.abs(balance).toLocaleString('en-IN')}</strong> — join to track it!</p>`;
  } else {
    balanceText = `<p style="margin:0;font-size:14px;color:#94a3b8;">Join to start tracking shared expenses and settle up any time.</p>`;
  }

  const noteHtml = note
    ? `<p style="margin:8px 0 0;font-size:13px;color:#64748b;font-style:italic;">"${note}"</p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>PayMatrix Invitation</title></head>
<body style="margin:0;padding:0;background:#07070f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:0 16px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:26px;font-weight:900;letter-spacing:-0.5px;">
        <span style="color:#818cf8;">Pay</span><span style="color:#34d399;">Matrix</span>
      </span>
    </div>

    <!-- Card -->
    <div style="background:#111118;border:1px solid rgba(255,255,255,0.09);border-radius:24px;overflow:hidden;">
      <!-- Top gradient bar -->
      <div style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899);"></div>

      <div style="padding:32px;">
        <!-- Avatar + Name -->
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;">
          <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;flex-shrink:0;">
            ${senderName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-size:17px;font-weight:700;color:#fff;">${senderName}</div>
            <div style="font-size:13px;color:#64748b;">${senderEmail}</div>
          </div>
        </div>

        <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#fff;line-height:1.2;">
          You've been invited to PayMatrix! 🎉
        </h1>
        <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;">
          <strong style="color:#c7d2fe;">${senderName}</strong> wants to track shared expenses with you on PayMatrix.
        </p>

        <!-- Balance highlight -->
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin-bottom:24px;">
          ${balanceText}
          ${noteHtml}
        </div>

        <!-- CTA Button -->
        <a href="${inviteUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 24px;border-radius:14px;letter-spacing:0.2px;">
          Accept Invitation →
        </a>

        <p style="margin:20px 0 0;font-size:12px;color:#475569;text-align:center;">
          Link expires in 7 days. If you didn't expect this, you can safely ignore it.<br>
          <a href="${inviteUrl}" style="color:#6366f1;word-break:break-all;">${inviteUrl}</a>
        </p>
      </div>
    </div>

    <p style="text-align:center;margin-top:24px;font-size:12px;color:#334155;">
      PayMatrix — Split smarter, settle faster.
    </p>
  </div>
</body>
</html>`;

  return resend.emails.send({
    from: 'PayMatrix <onboarding@resend.dev>',
    to: receiverEmail,
    subject: `${senderName} invited you to PayMatrix 💸`,
    html,
  });
}
