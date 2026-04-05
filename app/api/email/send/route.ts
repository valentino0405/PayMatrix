import { NextRequest, NextResponse } from 'next/server';
import { sendPlainTextEmail, textEmailSchema } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = textEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please fill in all required fields correctly.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await sendPlainTextEmail(parsed.data);

    return NextResponse.json(
      {
        success: true,
        message: 'Email sent successfully.',
        messageId: result.messageId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('EMAIL_SEND_ERROR:', error);

    const message = error instanceof Error ? error.message : 'Failed to send email.';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
