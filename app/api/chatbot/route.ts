import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const DEFAULT_MODEL_CANDIDATES = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
];

function extractRetryDelaySeconds(error: any): number | null {
  const details = Array.isArray(error?.errorDetails) ? error.errorDetails : [];
  const retryInfo = details.find((d: any) => d?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
  const retryDelay = String(retryInfo?.retryDelay || '');
  const match = retryDelay.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function isQuotaOrRateLimitError(error: any): boolean {
  if (error?.status === 429) return true;
  const msg = String(error?.message || '');
  return /quota|rate limit|too many requests/i.test(msg);
}

function isModelNotFoundOrUnsupported(error: any): boolean {
  if (error?.status === 404) return true;
  const msg = String(error?.message || '');
  return /not found|not supported|listmodels/i.test(msg);
}

const SYSTEM_PROMPT = `You are the PayMatrix Smart Financial Copilot — an advanced AI assistant built into a group expense management app.

Your job:
1. Help users understand their debts and group finances
2. Guide them to the right part of the UI
3. Suggest smart financial actions
4. Be friendly, witty, and concise

CRITICAL: You MUST respond with ONLY a valid JSON object. No markdown, no explanation, just the JSON.

Required JSON schema:
{
  "text": "Your friendly response here. Use emojis. Keep it under 3 sentences.",
  "action": "highlight | navigate | no_action",
  "uiTarget": "CSS selector like '#add-expense-btn' if highlighting, URL path like '/global-settle' if navigating, or null"
}

Action rules:
- User wants to add expense → action: highlight, uiTarget: "#add-expense-btn"
- User asks about debts/balances → action: no_action, explain in text using the context data
- User wants to settle/optimize debts → action: navigate, uiTarget: "/global-settle"
- General questions → action: no_action, uiTarget: null`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { text: 'AI is not configured. Please add GEMINI_API_KEY.', action: 'no_action', uiTarget: null },
        { status: 500 }
      );
    }

    const { messages, context } = await req.json();

    // Optional override, e.g. GEMINI_MODEL=gemini-2.0-flash-lite
    const configuredModel = process.env.GEMINI_MODEL?.trim();
    const modelCandidates = [configuredModel, ...DEFAULT_MODEL_CANDIDATES].filter(
      (modelName, index, arr): modelName is string => Boolean(modelName) && arr.indexOf(modelName) === index
    );

    // Build context
    const contextStr = [
      'Current App State:',
      `Group: ${context?.group?.name || 'N/A'}`,
      `User: ${context?.userName || 'User'}`,
      `Members: ${JSON.stringify(context?.group?.members || [])}`,
      `Balances: ${JSON.stringify(context?.netBalances || {})}`,
      `Recent Expenses: ${JSON.stringify((context?.recentExpenses || []).slice(0, 5))}`,
    ].join('\n');

    const conversationHistory = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const latestUserMessage = messages[messages.length - 1]?.content || '';

    // Try multiple models to gracefully handle deprecations or unsupported versions.
    let result: any = null;
    let lastError: any = null;
    let quotaError: any = null;
    let modelNotFoundError: any = null;

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${SYSTEM_PROMPT}\n\n${contextStr}\n\nUser Message: ${latestUserMessage}` }],
            },
            ...conversationHistory.slice(-4, -1),
          ],
        });
        break;
      } catch (error: any) {
        lastError = error;
        const errorMessage = String(error?.message || '');

        if (isQuotaOrRateLimitError(error)) {
          quotaError = error;
        }
        if (isModelNotFoundOrUnsupported(error)) {
          modelNotFoundError = error;
        }

        const shouldTryNextModel =
          error?.status === 429 ||
          error?.status === 404 ||
          /not found|not supported|listmodels|quota|rate limit|too many requests/i.test(errorMessage);

        if (!shouldTryNextModel) {
          throw error;
        }
      }
    }

    if (!result) {
      if (quotaError) {
        const retrySeconds = extractRetryDelaySeconds(quotaError);
        const retryText = retrySeconds
          ? `AI quota reached right now. Please retry in about ${retrySeconds}s, or update Gemini billing/quota. ⏳`
          : 'AI quota reached right now. Please retry in a moment, or update Gemini billing/quota. ⏳';

        return NextResponse.json({ text: retryText, action: 'no_action', uiTarget: null });
      }

      if (modelNotFoundError) {
        return NextResponse.json({
          text: 'AI model is unavailable for this API key/project right now. Set GEMINI_MODEL to a currently supported model and retry. 🤖',
          action: 'no_action',
          uiTarget: null,
        });
      }

      throw lastError || new Error('No supported Gemini model available.');
    }

    const response = await result.response;
    const text = response.text();
    
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = { text: text, action: 'no_action', uiTarget: null };
    }

    return NextResponse.json(json);

  } catch (error: any) {
    console.error('Chatbot API Error:', error);

    if (isQuotaOrRateLimitError(error)) {
      const retrySeconds = extractRetryDelaySeconds(error);
      const retryText = retrySeconds
        ? `AI quota reached right now. Please retry in about ${retrySeconds}s, or update Gemini billing/quota. ⏳`
        : 'AI quota reached right now. Please retry in a moment, or update Gemini billing/quota. ⏳';

      // Return 200 so the chatbot UI can display a useful assistant message instead of generic failure fallback.
      return NextResponse.json({ text: retryText, action: 'no_action', uiTarget: null });
    }

    if (isModelNotFoundOrUnsupported(error)) {
      return NextResponse.json({
        text: 'AI model is unavailable for this API key/project right now. Please try a supported model via GEMINI_MODEL. 🤖',
        action: 'no_action',
        uiTarget: null,
      });
    }

    return NextResponse.json(
      { text: 'Oops! My AI circuits are a bit fuzzy. Try again? 🤖', action: 'no_action', uiTarget: null },
      { status: 500 }
    );
  }
}
