'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, Trash2, UtensilsCrossed, Plane, Home, PartyPopper, ShoppingBag, Zap, Heart, MoreHorizontal, Search, Filter, Sparkles, AlertTriangle, Mic, ScanLine } from 'lucide-react';
import { useStore, Category, SplitType, Member } from '@/lib/store';

// Allow SpeechRecognition types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const CATEGORY_META: Record<Category, { icon: React.ElementType; emoji: string; color: string }> = {
  Food:          { icon: UtensilsCrossed, emoji: '🍕', color: '#f59e0b' },
  Travel:        { icon: Plane,           emoji: '✈️', color: '#3b82f6' },
  Accommodation: { icon: Home,            emoji: '🏠', color: '#8b5cf6' },
  Entertainment: { icon: PartyPopper,     emoji: '🎉', color: '#ec4899' },
  Shopping:      { icon: ShoppingBag,     emoji: '🛍️', color: '#10b981' },
  Utilities:     { icon: Zap,             emoji: '💡', color: '#f97316' },
  Health:        { icon: Heart,           emoji: '💊', color: '#ef4444' },
  Other:         { icon: MoreHorizontal,  emoji: '💼', color: '#6366f1' },
};
const CATEGORIES = Object.keys(CATEGORY_META) as Category[];
const SPLIT_TYPES: { val: SplitType; label: string }[] = [
  { val: 'equal', label: 'Equal' },
  { val: 'unequal', label: 'Unequal' },
  { val: 'percentage', label: '%' },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function parseNLP(text: string, members: Member[]): { amount?: number; category?: Category; paidById?: string; paidByName?: string } {
  const amountMatch = text.match(/₹?\s*(\d+(?:\.\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
  
  const lower = text.toLowerCase();
  
  const cat: Category | undefined =
    lower.match(/food|lunch|dinner|breakfast|eat|meal|snack|coffee|chai|pizza/) ? 'Food' :
    lower.match(/flight|train|cab|taxi|bus|uber|ola|petrol|fuel|travel/) ? 'Travel' :
    lower.match(/hotel|stay|hostel|airbnb|room|rent|house/) ? 'Accommodation' :
    lower.match(/movie|theater|club|party|event|game|sport|concert/) ? 'Entertainment' :
    lower.match(/shop|buy|purchase|clothes|grocery|market/) ? 'Shopping' :
    lower.match(/electric|water|wifi|internet|bill|utility/) ? 'Utilities' :
    lower.match(/doctor|medical|pharma|medicine|health|gym/) ? 'Health' :
    undefined;

  // Try to extract the payer (e.g. "by Alex", "Alex paid")
  let paidById: string | undefined;
  let paidByName: string | undefined;
  for (const m of members) {
    if (lower.includes(m.name.toLowerCase())) {
      paidById = m.id;
      paidByName = m.name;
      break;
    }
  }

  return { amount, category: cat, paidById, paidByName };
}

function AddExpenseModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { getGroup, addExpense } = useStore();
  const group = getGroup(groupId)!;
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(group.members[0]?.id ?? '');
  const [category, setCategory] = useState<Category>('Food');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [splits, setSplits] = useState<Record<string, string>>({});
  const prevSplitTypeRef = useRef<SplitType>('equal');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nlpMatch, setNlpMatch] = useState<{ amt?: number; cat?: Category; payer?: string }>({});
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (splitType === 'equal') {
      const share = parseFloat(amount) / group.members.length;
      const s: Record<string, string> = {};
      group.members.forEach(m => { s[m.id] = isNaN(share) ? '' : share.toFixed(2); });
      setSplits(s);
    } else if (splitType === 'percentage') {
      const share = (100 / group.members.length).toFixed(2);
      const s: Record<string, string> = {};
      group.members.forEach(m => { s[m.id] = share; });
      setSplits(s);
    } else {
      setSplits(prev => {
        const next: Record<string, string> = {};

        // If user switched from percentage to unequal, convert % to amount so values remain meaningful.
        if (prevSplitTypeRef.current === 'percentage') {
          const total = parseFloat(amount) || 0;
          group.members.forEach(m => {
            const pct = parseFloat(prev[m.id] || '0');
            const amt = (pct / 100) * total;
            next[m.id] = Number.isFinite(amt) ? amt.toFixed(2) : '0';
          });
          return next;
        }

        // Keep unequal values if already editing unequal; otherwise seed with equal currency shares.
        if (prevSplitTypeRef.current === 'unequal') {
          group.members.forEach(m => { next[m.id] = prev[m.id] ?? '0'; });
          return next;
        }

        const total = parseFloat(amount) || 0;
        const share = group.members.length > 0 ? total / group.members.length : 0;
        group.members.forEach(m => { next[m.id] = Number.isFinite(share) ? share.toFixed(2) : '0'; });
        return next;
      });
    }

    prevSplitTypeRef.current = splitType;
  }, [amount, splitType, group.members]);

  const handleDescChange = (val: string) => {
    setDesc(val);
    const parsed = parseNLP(val, group.members);
    
    // Auto-fill states if confident
    if (parsed.amount && !amount) setAmount(parsed.amount.toString());
    if (parsed.category) setCategory(parsed.category);
    if (parsed.paidById) setPaidBy(parsed.paidById);
    
    // Store match separately for UI highlight
    setNlpMatch({ amt: parsed.amount, cat: parsed.category, payer: parsed.paidByName });
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('Voice input is not supported in your browser.');
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const speechResult = event.results[0][0].transcript;
      handleDescChange(speechResult);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  const validate = (): boolean => {
    const total = parseFloat(amount);
    if (!desc.trim()) { setError('Enter a description'); return false; }
    if (!total || total <= 0) { setError('Enter a valid amount'); return false; }
    if (!paidBy) { setError('Select who paid'); return false; }
    if (splitType === 'unequal') {
      const sum = Object.values(splits).reduce((a, v) => a + parseFloat(v || '0'), 0);
      if (Math.abs(sum - total) > 0.5) { setError(`Splits must add to ₹${total} (currently ₹${sum.toFixed(2)})`); return false; }
    }
    if (splitType === 'percentage') {
      const sum = Object.values(splits).reduce((a, v) => a + parseFloat(v || '0'), 0);
      if (Math.abs(sum - 100) > 0.5) { setError(`Percentages must add to 100% (currently ${sum.toFixed(1)}%)`); return false; }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    const total = parseFloat(amount);
    const finalSplits = group.members.map(m => {
      let amt: number;
      if (splitType === 'equal') amt = total / group.members.length;
      else if (splitType === 'percentage') amt = (parseFloat(splits[m.id] || '0') / 100) * total;
      else amt = parseFloat(splits[m.id] || '0');
      return { memberId: m.id, amount: Math.round(amt * 100) / 100 };
    });
    setSubmitting(true);
    try {
      await addExpense({ groupId, description: desc.trim(), amount: total, paidBy, splitType, splits: finalSplits, category });
      onClose();
    } finally { setSubmitting(false); }
  };

  const total = parseFloat(amount) || 0;
  const getPctSum = () => Object.values(splits).reduce((a, v) => a + parseFloat(v || '0'), 0);
  const getUnequalSum = () => Object.values(splits).reduce((a, v) => a + parseFloat(v || '0'), 0);

  const isComplexSplit = splitType === 'unequal' && group.members.length > 2 && Object.values(splits).filter(v => parseFloat(v||'0') > 0).length > 2;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111118] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.07] sticky top-0 bg-[#111118] z-10">
          <h2 className="text-lg font-bold text-white">Add Expense</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            {/* RESOLVED CONFLICT: Kept the Smart Voice Navigation & Highlight Chips */}
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description & Smart Input</label>
            <div className="relative">
              <input autoFocus value={desc} onChange={e => handleDescChange(e.target.value)}
                placeholder='e.g. "Lunch at Taj by Alex for 500"'
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-4 pr-12 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 transition-all text-sm" />
              <button 
                type="button" 
                onClick={startListening}
                className={`absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg transition-all ${isListening ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                title="Speak expense details"
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
            
            {/* NLP Smart Extraction UI */}
            {desc.trim() && (nlpMatch.amt || nlpMatch.cat || nlpMatch.payer) ? (
              <div className="mt-2 flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-top-1 duration-300">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mr-1">Auto-detected:</span>
                {nlpMatch.amt && <span className="rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-1.5 py-0.5 text-xs font-bold">₹{nlpMatch.amt}</span>}
                {nlpMatch.payer && <span className="rounded bg-violet-500/20 border border-violet-500/30 text-violet-300 px-1.5 py-0.5 text-xs font-semibold">By {nlpMatch.payer}</span>}
                {nlpMatch.cat && <span className="rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 text-xs font-semibold flex items-center gap-1">{CATEGORY_META[nlpMatch.cat].emoji} {nlpMatch.cat}</span>}
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Type naturally to auto-fill details!
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Amount (₹)</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 transition-all text-xl font-bold" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Paid by</label>
            <div className="flex flex-wrap gap-2">
              {group.members.map(m => (
                <button key={m.id} type="button" onClick={() => setPaidBy(m.id)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${paidBy === m.id ? 'border-indigo-500/60 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                  <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold" style={{ backgroundColor: m.color }}>{m.name[0]}</div>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`rounded-xl py-2 text-xs font-semibold transition-all border flex flex-col items-center gap-0.5 ${category === c ? 'border-white/30 bg-white/10 text-white' : 'border-white/6 bg-white/3 text-slate-400 hover:bg-white/[0.07]'}`}>
                  <span className="text-base">{CATEGORY_META[c].emoji}</span>
                  <span className="truncate">{c}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Split Type</label>
            <div className="flex gap-2">
              {SPLIT_TYPES.map(st => (
                <button key={st.val} type="button" onClick={() => setSplitType(st.val)}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all border ${splitType === st.val ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                  {st.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Smart suggestion for splitting */}
          {isComplexSplit && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong>Smart Suggestion:</strong> You're doing a complex split across {group.members.length} people. Using the <strong>"Equal"</strong> split might reduce calculation errors and completely settle debts faster in our optimizer!
              </div>
            </div>
          )}

          {splitType !== 'equal' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Member Splits</label>
                <span className={`text-xs font-bold ${splitType === 'percentage' ? Math.abs(getPctSum() - 100) < 0.5 ? 'text-emerald-400' : 'text-rose-400' : Math.abs(getUnequalSum() - total) < 0.5 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {splitType === 'percentage' ? `${getPctSum().toFixed(1)} / 100%` : `₹${getUnequalSum().toFixed(0)} / ₹${total}`}
                </span>
              </div>
              <div className="space-y-2">
                {group.members.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[11px] text-white font-bold" style={{ backgroundColor: m.color }}>{m.name[0]}</div>
                    <span className="flex-1 text-sm text-slate-300">{m.name}</span>
                    <div className="relative">
                      {splitType === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>}
                      {splitType === 'unequal' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>}
                      <input type="number" min="0" step="0.01" value={splits[m.id] ?? ''} onChange={e => setSplits(p => ({ ...p, [m.id]: e.target.value }))}
                        className={`w-24 rounded-lg border border-white/10 bg-white/5 py-2 text-right text-sm text-white outline-none focus:border-indigo-500/60 transition-all ${splitType === 'unequal' ? 'pl-6 pr-3' : 'pl-3 pr-6'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {splitType === 'equal' && total > 0 && (
            <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-3 text-sm text-indigo-300">
              Each person pays <span className="font-bold">₹{(total / group.members.length).toFixed(2)}</span>
            </div>
          )}
          {error && <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2 text-sm text-rose-400">{error}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-semibold text-slate-400 hover:bg-white/5 transition-all">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:opacity-60">
              {submitting ? 'Saving to DB...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GroupExpensesPage() {
  const { id } = useParams<{ id: string }>();
  const { getGroup, getGroupExpenses, deleteExpense } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'All'>('All');
  const [filterMember, setFilterMember] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);

  const group = getGroup(id);
  const expenses = getGroupExpenses(id);
  if (!group) return null;

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = [...expenses]
    .filter(e => {
      if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory !== 'All' && e.category !== filterCategory) return false;
      if (filterMember !== 'All' && e.paidBy !== filterMember) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getMember = (mid: string) => group.members.find(m => m.id === mid);
  const activeFilters = [filterCategory !== 'All', filterMember !== 'All', search !== ''].filter(Boolean).length;

  return (
    <div className="pb-28 sm:pb-8">
      {/* Summary bar */}
      {expenses.length > 0 && (
        <div className="mb-5 flex gap-3 flex-wrap">
          {[
            { label: 'Total Expenses', value: `₹${totalAmount.toLocaleString('en-IN')}` },
            { label: 'Transactions', value: expenses.length },
            { label: 'Members', value: group.members.length },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 flex-1 min-w-30">
              <div className="text-xs text-slate-500 mb-0.5">{s.label}</div>
              <div className="text-lg font-extrabold text-white">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Transaction History Filters ─────────────────────────────────────── */}
      {expenses.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search expenses..."
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 transition-all" />
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${showFilters || activeFilters > 0 ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}>
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilters > 0 && <span className="rounded-full bg-indigo-500 text-white text-[9px] px-1.5 py-0.5 font-bold">{activeFilters}</span>}
            </button>
          </div>

          {showFilters && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/3 p-4 space-y-3">
              {/* Category filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['All', ...CATEGORIES] as (Category | 'All')[]).map(c => (
                    <button key={c} onClick={() => setFilterCategory(c)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${filterCategory === c ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'}`}>
                      {c === 'All' ? '🌐 All' : `${CATEGORY_META[c].emoji} ${c}`}
                    </button>
                  ))}
                </div>
              </div>
              {/* Member filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Paid By</label>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setFilterMember('All')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${filterMember === 'All' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'}`}>
                    👥 All
                  </button>
                  {group.members.map(m => (
                    <button key={m.id} onClick={() => setFilterMember(m.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${filterMember === m.id ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'}`}>
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: m.color }} />
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilters > 0 && (
                <button onClick={() => { setSearch(''); setFilterCategory('All'); setFilterMember('All'); }}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors">
                  ✕ Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Results count */}
          {(search || filterCategory !== 'All' || filterMember !== 'All') && (
            <p className="text-xs text-slate-500">{filtered.length} of {expenses.length} expenses</p>
          )}
        </div>
      )}

      {/* Expense list */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(expense => {
            const payer = getMember(expense.paidBy);
            const cat = CATEGORY_META[expense.category];
            // RESOLVED CONFLICT: Included the suspicious expense styling
            return (
              <div key={expense.id} className={`group relative rounded-2xl border p-4 transition-all hover:bg-white/5 ${expense.isSuspicious ? 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60' : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: cat.color + '20' }}>{cat.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{expense.description}</p>
                          {expense.isSuspicious && (
                            <span className="flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 uppercase tracking-wider border border-rose-500/30">
                              <AlertTriangle className="h-3 w-3" /> Fraud Risk
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Paid by <span className="font-semibold" style={{ color: payer?.color }}>{payer?.name ?? 'Unknown'}</span>
                          {' · '}
                          <span className="capitalize">
                            {expense.splitType === 'equal' ? `Split equally · ₹${(expense.amount / expense.splits.length).toFixed(0)} each` :
                             expense.splitType === 'percentage' ? 'Percentage split' : 'Custom split'}
                          </span>
                          {' · '}<span className="text-slate-600">{timeAgo(expense.createdAt)}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-extrabold text-white">₹{expense.amount.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">{CATEGORY_META[expense.category].emoji} {expense.category}</div>
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          className="mt-2 ml-auto flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-rose-500/20 hover:text-rose-400 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label="Delete expense"
                          title="Delete expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {expense.splitType !== 'equal' && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {expense.splits.map(s => {
                          const m = getMember(s.memberId);
                          return (
                            <span key={s.memberId} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: (m?.color ?? '#666') + '25', color: m?.color }}>
                              {m?.name}: ₹{s.amount.toFixed(0)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 text-5xl">{search || filterCategory !== 'All' || filterMember !== 'All' ? '🔍' : '🧾'}</div>
          <h3 className="text-lg font-bold text-white">
            {search || filterCategory !== 'All' || filterMember !== 'All' ? 'No matching expenses' : 'No expenses yet'}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {search || filterCategory !== 'All' || filterMember !== 'All' ? 'Try different filters' : 'Add your first expense to get started'}
          </p>
        </div>
      )}

      {/* Scan + Add Expense actions */}
      <Link
        href={`/scan?groupId=${id}`}
        className="fixed bottom-6 left-4 sm:left-6 z-30 flex items-center gap-2 rounded-2xl border border-indigo-500/40 bg-[#0f1020] px-3.5 sm:px-5 py-3 sm:py-3.5 text-sm font-bold text-indigo-300 shadow-[0_8px_32px_rgba(79,70,229,0.28)] hover:bg-[#151735] transition-all hover:-translate-y-0.5"
      >
        <ScanLine className="h-5 w-5" />
        <span className="hidden sm:inline">Scan Bill</span>
      </Link>

      {/* FAB */}
      <button onClick={() => setShowAdd(true)} id="add-expense-btn"
        className="fixed bottom-6 right-4 sm:right-6 flex items-center gap-2 rounded-2xl bg-indigo-600 px-3.5 sm:px-5 py-3 sm:py-3.5 text-sm font-bold text-white shadow-[0_8px_32px_rgba(99,102,241,0.5)] hover:bg-indigo-500 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(99,102,241,0.6)] z-30">
        <Plus className="h-5 w-5" />
        <span className="hidden sm:inline">Add Expense</span>
      </button>

      {showAdd && <AddExpenseModal groupId={id} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
