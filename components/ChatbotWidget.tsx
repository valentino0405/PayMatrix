'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  Bot, X, Send, Sparkles, Loader2, DollarSign,
  TrendingUp, Plus, ChevronDown, Mic, MicOff
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useWalkthrough } from '@/lib/walkthrough-context';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  text: string;
  action: 'highlight' | 'navigate' | 'no_action' | 'walkthrough_start';
  uiTarget: string | null;
}

const SUGGESTIONS = [
  { icon: Sparkles,    label: 'Walk me through'      },
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
  const params = useParams();
  const { user } = useUser();
  const { getGroup, getNetBalances, getGroupExpenses } = useStore();
  
  const activeGroupId = groupId || (params?.id as string);

  const { startWalkthrough } = useWalkthrough();

  const [isOpen, setIsOpen]     = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hey! 👋 I'm your PayMatrix Copilot. Your intelligent financial assistant. How can I help you today?"
    }
  ]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [highlightedEl, setHighlightedEl] = useState<HTMLElement | null>(null);
  const [showNudge, setShowNudge] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const debounceRef    = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const [isNudged, setIsNudged] = useState(false);
  useEffect(() => {
    // Show text bubble nudge after 3 seconds
    const nudgeTimer = setTimeout(() => {
      if (!isOpen) setShowNudge(true);
    }, 3000);

    // Hide bubble after 10 seconds
    const hideTimer = setTimeout(() => {
      setShowNudge(false);
    }, 13000);

    if (!isOpen && !isNudged) {
      const authNudge = setTimeout(() => {
        setIsNudged(true);
        setTimeout(() => setIsNudged(false), 5000);
      }, 8000);
      return () => {
        clearTimeout(nudgeTimer);
        clearTimeout(hideTimer);
        clearTimeout(authNudge);
      };
    }
    return () => {
      clearTimeout(nudgeTimer);
      clearTimeout(hideTimer);
    };
  }, [isOpen]);

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
    if (!activeGroupId) return { 
      user: user?.fullName || user?.firstName || 'User',
      ui: { currentPage: typeof window !== 'undefined' ? window.location.pathname : '/', availableActions: ["view_balances"] }
    };
    
    const group = getGroup(activeGroupId);
    if (!group) return {};

    // --- STEP 4: FIX ID -> NAME MAPPING ---
    const memberMap = new Map(group.members.map(m => [m.id, m.name]));
    
    const rawBalances = getNetBalances(activeGroupId, true);
    const mappedBalances = Object.fromEntries(
      Object.entries(rawBalances).map(([id, amount]) => [memberMap.get(id) || id, amount])
    );

    const mappedExpenses = getGroupExpenses(activeGroupId)
      .slice(0, 8)
      .map(e => ({
        description: e.description,
        amount: e.amount,
        category: e.category,
        paidBy: memberMap.get(e.paidBy) || e.paidBy,
        date: e.createdAt
      }));

    const totalExpenses = getGroupExpenses(activeGroupId).reduce((s, e) => s + e.amount, 0);

    return {
      user: user?.fullName || user?.firstName || 'User',
      group: {
        id: group.id,
        name: group.name,
        type: group.type,
        members: group.members.map(m => m.name),
      },
      metrics: {
        totalGroupExpenses: totalExpenses
      },
      balances: mappedBalances,
      recentExpenses: mappedExpenses,
      ui: {
        currentPage: typeof window !== 'undefined' ? window.location.pathname : '/',
        availableActions: ["add_expense", "settle", "view_balances", "optimize_debts"]
      }
    };
  }, [activeGroupId, getGroup, getNetBalances, getGroupExpenses, user]);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isTyping) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    
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

      const contentType = res.headers.get('Content-Type');

      if (contentType?.includes('application/json')) {
        const data: AIResponse = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
        if (data.action === 'navigate') {
          router.push(data.uiTarget!);
        } else if (data.action === 'highlight') {
          const el = document.querySelector(data.uiTarget!);
          if (el) el.classList.add('ring-4', 'ring-indigo-500', 'ring-offset-2', 'transition-all', 'duration-500');
        } else if (data.action as string === 'walkthrough_start') {
          setIsTyping(false);
          startWalkthrough();
          return;
        }
      } 
      else {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No reader');

        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          fullContent += chunk;

          setMessages(prev => {
            const next = [...prev];
            next[next.length - 1].content = fullContent;
            return next;
          });
        }

        // --- STEP 3: POST-PROCESS RESPONSE (Navigation & Commands) ---
        if (fullContent.includes('{') && fullContent.includes('}')) {
          try {
            // Find the last JSON block in the response
            const lastBrace = fullContent.lastIndexOf('}');
            const firstBrace = fullContent.lastIndexOf('{', lastBrace);
            const jsonStr = fullContent.substring(firstBrace, lastBrace + 1);
            const data = JSON.parse(jsonStr);
            
            if ((data.type === 'navigation' || data.intent === 'navigate') && data.target) {
              applyHighlight(data.target);
              if (data.target.startsWith('/')) {
                setTimeout(() => router.push(data.target), 1200);
              }
            } else if (data.intent === 'add_expense') {
              applyHighlight('#add-expense-btn');
            }
          } catch (e) {
            console.warn('Silent parse error on stream JSON', e);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'My AI circuits are temporarily offline. Catch you in a bit! 🤖'
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, messages, buildContext, applyHighlight, router]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    // Use timeout to simulate debounce if needed, but here we just prevent duplicate
    sendMessage(input);
  };

  const handleSuggestion = (label: string) => {
    sendMessage(label);
  };

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

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Copilot"
        className={`fixed bottom-24 right-6 z-60 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-[0_8px_30px_rgba(99,102,241,0.55)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(99,102,241,0.7)] ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'} ${isNudged ? 'animate-bounce ring-4 ring-indigo-500/50' : ''}`}
      >
        <span className="absolute inset-0 rounded-full animate-ping bg-indigo-500 opacity-20" />
        <Sparkles className="h-6 w-6 relative" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#07070f]">
          <span className="text-[8px] font-bold text-white">AI</span>
        </span>
      </button>

      <div
        className={`fixed bottom-6 right-6 z-60 flex flex-col w-90 sm:w-105 overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e1a]/97 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.7)] transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 h-135' : 'scale-0 opacity-0 h-0 pointer-events-none'}`}
      >

        <div className="relative shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-linear-to-r from-indigo-500/10 via-violet-500/5 to-transparent overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-indigo-600/10 to-transparent" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">PayMatrix Copilot</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">OpenRouter Powered</span>
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
                    : 'rounded-bl-sm bg-white/6 border border-white/8 text-slate-200 shadow-xl'
                }`}
              >
                {msg.content || (msg.role === 'assistant' && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />)}
              </div>
            </div>
          ))}

          {isTyping && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex items-end gap-2 justify-start">
              <div className="shrink-0 mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-500/30">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-white/6 border border-white/8 px-4 py-3 flex items-center gap-1.5">
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
                    style={{ animationDelay: delay + 'ms' }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

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

        <div className="shrink-0 border-t border-white/[0.07] bg-white/2 p-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
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
              placeholder="Ask PayMatrix Copilot..."
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
          <p className="mt-1.5 text-center text-[9px] text-slate-600 tracking-wide uppercase">OpenRouter AI Integration • Smarter Settlements</p>
        </div>
      </div>
      
      {/* Toggle Button & Nudge Bubble */}
      <div className="fixed bottom-6 right-6 z-100 flex flex-col items-end gap-3">
        {showNudge && !isOpen && (
          <button
            onClick={() => {
              setIsOpen(true);
              const mockEvent = { preventDefault: () => {} } as React.FormEvent;
              setInput('Walk me through the app');
              setShowNudge(false);
              // We'll let the user hit enter or we can trigger handleSubmit manually
              // For better UX, we'll just open and populate the input
            }}
            className="group relative flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-[#111118]/90 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500 pointer-events-auto"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-white">New here?</p>
              <p className="text-[10px] text-slate-400">Click for a complete walkthrough 🚀</p>
            </div>
            <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-r border-b border-indigo-500/30 bg-[#111118]" />
          </button>
        )}
        
        <button
          id="chatbot-toggle-btn"
          onClick={() => {
            setIsOpen(!isOpen);
            setShowNudge(false);
          }}
          className={`group flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-500 pointer-events-auto ${
            isOpen 
              ? 'bg-[#1a1a2e] text-white shadow-2xl rotate-90' 
              : `bg-indigo-600 text-white shadow-[0_8px_32px_rgba(99,102,241,0.5)] hover:bg-indigo-500 hover:scale-110 ${isNudged ? 'animate-bounce' : ''}`
          }`}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-7 w-7" />}
        </button>
      </div>

      {highlightedEl && (
        <div className="fixed inset-0 z-55 cursor-pointer" onClick={removeHighlight} />
      )}
    </>
  );
}
