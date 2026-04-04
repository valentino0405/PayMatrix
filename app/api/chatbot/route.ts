import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

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

    // Inject system prompt and context into the first message or as a separate system instruction
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${contextStr}\n\nUser Message: ${messages[messages.length - 1].content}` }] }
      ]
    });

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
    return NextResponse.json(
      { text: 'Oops! My AI circuits are a bit fuzzy. Try again? 🤖', action: 'no_action', uiTarget: null },
      { status: 500 }
    );
  }
}
