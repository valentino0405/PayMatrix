import { NextRequest, NextResponse } from 'next/server';
import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || ''
});

const SYSTEM_PROMPT = `You are PayMatrix Copilot, an intelligent financial assistant inside a web app.

You ALWAYS receive structured CONTEXT containing:
- user info
- group info
- balances
- expenses
- UI state

You MUST:
1. Answer using ONLY the provided context
2. Interpret balances and show meaningful names (not IDs)
3. Return clean, human-readable responses
4. Suggest actions when relevant
5. If command detected, return JSON

RULES:
- NEVER show raw IDs (like mnjzfi2u9kn)
- Always convert data into readable format
- Be concise and helpful
- If no data → say clearly

RESPONSE TYPES:
1. Conversational: "You are owed ₹1200. Aman owes ₹500 and Ravi owes ₹700."
2. Command JSON: {"intent": "add_expense", "amount": 500, "category": "food"}
3. Navigation: {"type": "navigation", "message": "Click Add Expense button", "target": "#add-expense-btn"}`;

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json();
    const userMessage = messages[messages.length - 1]?.content || '';
    const lowerMessage = userMessage.toLowerCase();

    // --- HYBRID COMMAND SYSTEM ---
    if (lowerMessage.includes("who owes") || lowerMessage.includes("balance")) {
      const balanceEntries = Object.entries(context?.balances || {});
      const text = balanceEntries.length > 0 
        ? `Here are the current balances: ${balanceEntries.map(([name, bal]) => `${name}: ${(bal as number) > 0 ? '+' : ''}${bal}`).join(', ')}.`
        : "Everyone is settled up! No active debts. 🙌";
      
      return NextResponse.json({
        text,
        action: 'no_action',
        uiTarget: null
      });
    }

    if (lowerMessage.includes("settle") || lowerMessage.includes("optimize")) {
      return NextResponse.json({
        text: "I'll take you to the settlement optimizer where we can minimize transactions! 🚀",
        action: 'navigate',
        uiTarget: '/global-settle'
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { text: 'AI is not configured. Please add OPENROUTER_API_KEY in your .env.local file.', action: 'no_action', uiTarget: null },
        { status: 500 }
      );
    }

    // --- STEP 1: CONTEXT INJECTION SYSTEM ---
    const contextStr = `
CONTEXT:
${JSON.stringify(context, null, 2)}

USER QUERY:
${userMessage}
`;

    // --- STEP 4: CALL OPENROUTER ---
    const response = await openrouter.chat.send({
      chatRequest: {
        model: "openrouter/free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextStr }
        ],
        stream: true
      }
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

  } catch (error: any) {
    console.error('Chatbot API Error:', error);
    return NextResponse.json(
      { text: "AI is temporarily unavailable. Please try again. 🤖", action: 'no_action', uiTarget: null },
      { status: 500 }
    );
  }
}
