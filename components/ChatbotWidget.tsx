'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  Bot, X, Send, Sparkles, Loader2, DollarSign,
  TrendingUp, Plus, ChevronDown, Mic, MicOff
} from 'lucide-react';
import { useStore } from '@/lib/store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  text: string;
  action: 'highlight' | 'navigate' | 'no_action';
  uiTarget: string | null;
}

// Quick suggestion chips shown on first load
const SUGGESTIONS = [
  { icon: DollarSign,  label: 'Who owes me?'         },
  { icon: TrendingUp,  label: 'Optimize my debts'    },
  { icon: Plus,        label: 'Add an expense'        },
];

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function ChatbotWidget({ groupId }: { groupId?: string }) {
  const router = useRouter();
  const { user } = useUser();
  const { getGroup, getNetBalances, getGroupExpenses } = useStore();

  const [isOpen, setIsOpen]     = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hey! 👋 I'm your PayMatrix Copilot. Ask me anything about your expenses, debts, or how to use the app!"
    }
  ]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [highlightedEl, setHighlightedEl] = useState<HTMLElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  // Proactive Nudge logic: after 8 seconds, if unopened, do a small pulse
  const [isNudged, setIsNudged] = useState(false);
  useEffect(() => {
    if (!isOpen && !isNudged) {
      const timer = setTimeout(() => {
        setIsNudged(true);
        // Remove nudge after some time
        setTimeout(() => setIsNudged(false), 5000);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isNudged]);

  // Cleanup highlight on unmount
  useEffect(() => {
    return () => { removeHighlight(); };
  }, []);

  const removeHighlight = useCallback(() => {
    if (highlightedEl) {
      highlightedEl.style.boxShadow = '';
      highlightedEl.style.outline   = '';
      highlightedEl.style.zIndex    = '';
      highlightedEl.style.position  = '';
      setHighlightedEl(null);
    }
  }, [highlightedEl]);

  const applyHighlight = useCallback((selector: string) => {
    removeHighlight();
    setTimeout(() => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.9), 0 0 30px rgba(99,102,241,0.5)';
      el.style.outline   = '2px solid rgba(99,102,241,0.6)';
      el.style.zIndex    = '9999';
      el.style.position  = 'relative';
      setHighlightedEl(el);
      // Auto-remove after 6 seconds
      setTimeout(() => {
        el.style.boxShadow = '';
        el.style.outline   = '';
        el.style.zIndex    = '';
        el.style.position  = '';
        setHighlightedEl(null);
      }, 6000);
    }, 400);
  }, [removeHighlight]);

  const buildContext = useCallback(() => {
    if (!groupId) return {};
    const group = getGroup(groupId);
    if (!group) return {};
    return {
      group: {
        name: group.name,
        type: group.type,
        members: group.members.map(m => ({ id: m.id, name: m.name })),
      },
      userName: user?.fullName || user?.firstName || 'User',
      netBalances: getNetBalances(groupId, true),
      recentExpenses: getGroupExpenses(groupId)
        .slice(0, 5)
        .map(e => ({ description: e.description, amount: e.amount, category: e.category, paidBy: e.paidBy })),
    };
  }, [groupId, getGroup, getNetBalances, getGroupExpenses, user]);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isTyping) return;

    const userMsg: Message = { role: 'user', content: userText.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          context: buildContext(),
        }),
      });

      const data: AIResponse = await res.json();

      setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);

      // Execute AI action
      if (data.action === 'highlight' && data.uiTarget) {
        applyHighlight(data.uiTarget);
      } else if (data.action === 'navigate' && data.uiTarget) {
        setTimeout(() => router.push(data.uiTarget!), 800);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'My circuits hit a snag. Try again! 🤖'
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, messages, buildContext, applyHighlight, router]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessage(input);
  };

  const handleSuggestion = (label: string) => {
    setInput(label);
    sendMessage(label);
  };

  // Voice input
  const toggleVoice = () => {
    const SR = (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return alert('Voice input not supported in this browser.');
    const recognition = new SR();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend   = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (ev: any) => {
      const transcript = ev.results[0][0].transcript;
      sendMessage(transcript);
    };
    recognition.start();
  };

  // ─── FAB ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Copilot"
        className={`fixed bottom-24 right-6 z-60 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-[0_8px_30px_rgba(99,102,241,0.55)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(99,102,241,0.7)] ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'} ${isNudged ? 'animate-bounce ring-4 ring-indigo-500/50' : ''}`}
      >
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full animate-ping bg-indigo-500 opacity-20" />
        <Sparkles className="h-6 w-6 relative" />
        {/* Notification dot */}
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#07070f]">
          <span className="text-[8px] font-bold text-white">AI</span>
        </span>
      </button>

      {/* Chat window */}
      <div
        className={`fixed bottom-6 right-6 z-60 flex flex-col w-90 sm:w-105 overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e1a]/97 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.7)] transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 h-135' : 'scale-0 opacity-0 h-0 pointer-events-none'}`}
      >

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="relative shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-linear-to-r from-indigo-500/10 via-violet-500/5 to-transparent overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-indigo-600/10 to-transparent" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Financial Copilot</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Gemini Powered</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-all"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* ── Messages ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
              {msg.role === 'assistant' && (
                <div className="shrink-0 mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-500/30">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'rounded-br-sm bg-linear-to-br from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/20'
                    : 'rounded-bl-sm bg-white/6 border border-white/8 text-slate-200'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-end gap-2 justify-start">
              <div className="shrink-0 mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-500/30">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-white/6 border border-white/8 px-4 py-3 flex items-center gap-1.5">
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce"
                    style={{ animationDelay: delay + 'ms' }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Suggestion chips (only on first load) ─────────────────────── */}
        {messages.length === 1 && !isTyping && (
          <div className="shrink-0 flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSuggestion(s.label)}
                className="shrink-0 flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all"
              >
                <s.icon className="h-3 w-3" />
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Input bar ─────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-white/[0.07] bg-white/2 p-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            {/* Voice button */}
            <button
              type="button"
              onClick={toggleVoice}
              className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-full border transition-all ${isListening ? 'border-rose-500/50 bg-rose-500/20 text-rose-400 animate-pulse' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
              title="Voice input"
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything about your finances..."
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all"
            />

            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-indigo-500/50 hover:-translate-y-0.5 disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none"
            >
              {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
            </button>
          </form>
          <p className="mt-1.5 text-center text-[10px] text-slate-600">Powered by Gemini 2.0 Flash ✨</p>
        </div>
      </div>

      {/* Highlight dismiss overlay — clicking anywhere removes highlight */}
      {highlightedEl && (
        <div className="fixed inset-0 z-55 cursor-pointer" onClick={removeHighlight} />
      )}
    </>
  );
}
