'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, Trash2, UtensilsCrossed, Plane, Home, PartyPopper, ShoppingBag, Zap, Heart, MoreHorizontal } from 'lucide-react';
import { useStore, Category, SplitType } from '@/lib/store';

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

// ── NLP quick parser ──────────────────────────────────────────────────────────
function parseNLP(text: string): { amount?: number; category?: Category } {
  const amountMatch = text.match(/₹?\s*(\d+(?:\.\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
  const lower = text.toLowerCase();
  const cat: Category | undefined =
    lower.match(/food|lunch|dinner|breakfast|eat|meal|snack|coffee|chai/) ? 'Food' :
    lower.match(/flight|train|cab|taxi|bus|uber|ola|petrol|fuel|travel/) ? 'Travel' :
    lower.match(/hotel|stay|hostel|airbnb|room|rent|house/) ? 'Accommodation' :
    lower.match(/movie|theater|club|party|event|game|sport|concert/) ? 'Entertainment' :
    lower.match(/shop|buy|purchase|clothes|grocery|market/) ? 'Shopping' :
    lower.match(/electric|water|wifi|internet|bill|utility/) ? 'Utilities' :
    lower.match(/doctor|medical|pharma|medicine|health|gym/) ? 'Health' :
    undefined;
  return { amount, category: cat };
}

// ── AddExpenseModal ───────────────────────────────────────────────────────────
function AddExpenseModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { getGroup, addExpense } = useStore();
  const group = getGroup(groupId)!;

  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(group.members[0]?.id ?? '');
  const [category, setCategory] = useState<Category>('Food');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [splits, setSplits] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  // Auto-compute equal splits whenever amount/splitType/members change
  useEffect(() => {
    if (splitType === 'equal') {
      const share = parseFloat(amount) / group.members.length;
      const newSplits: Record<string, string> = {};
      group.members.forEach(m => { newSplits[m.id] = isNaN(share) ? '' : share.toFixed(2); });
      setSplits(newSplits);
    } else if (splitType === 'percentage') {
      const share = (100 / group.members.length).toFixed(2);
      const newSplits: Record<string, string> = {};
      group.members.forEach(m => { newSplits[m.id] = share; });
      setSplits(newSplits);
    } else {
      // unequal — keep existing or init to 0
      setSplits(prev => {
        const next: Record<string, string> = {};
        group.members.forEach(m => { next[m.id] = prev[m.id] ?? '0'; });
        return next;
      });
    }
  }, [amount, splitType, group.members]);

  // NLP desc parsing
  const handleDescChange = (val: string) => {
    setDesc(val);
    const parsed = parseNLP(val);
    if (parsed.amount && !amount) setAmount(parsed.amount.toString());
    if (parsed.category) setCategory(parsed.category);
  };

  const handleSplitChange = (memberId: string, val: string) => {
    setSplits(p => ({ ...p, [memberId]: val }));
  };

  const validate = (): boolean => {
    const total = parseFloat(amount);
    if (!desc.trim()) { setError('Enter a description'); return false; }
    if (!total || total <= 0) { setError('Enter a valid amount'); return false; }
    if (!paidBy) { setError('Select who paid'); return false; }
    if (splitType === 'unequal') {
      const sum = Object.values(splits).reduce((a, v) => a + parseFloat(v || '0'), 0);
      if (Math.abs(sum - total) > 0.5) { setError(`Split amounts must add up to ₹${total} (currently ₹${sum.toFixed(2)})`); return false; }
    }
    if (splitType === 'percentage') {
      const sum = Object.values(splits).reduce((a, v) => a + parseFloat(v || '0'), 0);
      if (Math.abs(sum - 100) > 0.5) { setError(`Percentages must add up to 100% (currently ${sum.toFixed(1)}%)`); return false; }
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
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
    addExpense({ groupId, description: desc.trim(), amount: total, paidBy, splitType, splits: finalSplits, category });
    onClose();
  };

  const total = parseFloat(amount) || 0;
  const getPctSum = () => Object.values(splits).reduce((a, v) => a + parseFloat(v || '0'), 0);
  const getUnequalSum = () => Object.values(splits).reduce((a, v) => a + parseFloat(v || '0'), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111118] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.07] sticky top-0 bg-[#111118] z-10">
          <h2 className="text-lg font-bold text-white">Add Expense</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
            <input
              autoFocus
              value={desc}
              onChange={e => handleDescChange(e.target.value)}
              placeholder='e.g. "Lunch at Taj" or "paid 500 food"'
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all text-sm"
            />
            <p className="mt-1 text-xs text-slate-600">💡 Try typing "paid 500 for food" — AI auto-fills details</p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Amount (₹)</label>
            <input
              type="number" min="0" step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all text-xl font-bold"
            />
          </div>

          {/* Paid by */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Paid by</label>
            <div className="flex flex-wrap gap-2">
              {group.members.map(m => (
                <button
                  key={m.id} type="button" onClick={() => setPaidBy(m.id)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${paidBy === m.id ? 'border-indigo-500/60 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold" style={{ backgroundColor: m.color }}>{m.name[0]}</div>
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(c => (
                <button
                  key={c} type="button" onClick={() => setCategory(c)}
                  className={`rounded-xl py-2 text-xs font-semibold transition-all border flex flex-col items-center gap-0.5 ${category === c ? 'border-white/30 bg-white/10 text-white' : 'border-white/[0.06] bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]'}`}
                >
                  <span className="text-base">{CATEGORY_META[c].emoji}</span>
                  <span className="truncate">{c}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Split type */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Split Type</label>
            <div className="flex gap-2">
              {SPLIT_TYPES.map(st => (
                <button
                  key={st.val} type="button" onClick={() => setSplitType(st.val)}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all border ${splitType === st.val ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Split detail */}
          {splitType !== 'equal' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Member Splits</label>
                <span className={`text-xs font-bold ${
                  splitType === 'percentage'
                    ? Math.abs(getPctSum() - 100) < 0.5 ? 'text-emerald-400' : 'text-rose-400'
                    : Math.abs(getUnequalSum() - total) < 0.5 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {splitType === 'percentage' ? `${getPctSum().toFixed(1)} / 100%` : `₹${getUnequalSum().toFixed(0)} / ₹${total}`}
                </span>
              </div>
              <div className="space-y-2">
                {group.members.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[11px] text-white font-bold" style={{ backgroundColor: m.color }}>
                      {m.name[0]}
                    </div>
                    <span className="flex-1 text-sm text-slate-300">{m.name}</span>
                    <div className="relative">
                      {splitType === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>}
                      {splitType === 'unequal' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>}
                      <input
                        type="number" min="0" step="0.01"
                        value={splits[m.id] ?? ''}
                        onChange={e => handleSplitChange(m.id, e.target.value)}
                        className={`w-24 rounded-lg border border-white/10 bg-white/5 py-2 text-right text-sm text-white outline-none focus:border-indigo-500/60 transition-all ${splitType === 'unequal' ? 'pl-6 pr-3' : 'pl-3 pr-6'}`}
                      />
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

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2 text-sm text-rose-400">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-semibold text-slate-400 hover:bg-white/5 transition-all">
              Cancel
            </button>
            <button type="submit" className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]">
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main expenses page ────────────────────────────────────────────────────────
export default function GroupExpensesPage() {
  const { id } = useParams<{ id: string }>();
  const { getGroup, getGroupExpenses, deleteExpense } = useStore();
  const [showAdd, setShowAdd] = useState(false);

  const group = getGroup(id);
  const expenses = getGroupExpenses(id);
  if (!group) return null;

  const sorted = [...expenses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  const getMember = (memberId: string) => group.members.find(m => m.id === memberId);

  return (
    <div>
      {/* Summary bar */}
      {expenses.length > 0 && (
        <div className="mb-5 flex gap-3 flex-wrap">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 flex-1 min-w-[120px]">
            <div className="text-xs text-slate-500 mb-0.5">Total Expenses</div>
            <div className="text-lg font-extrabold text-white">₹{totalAmount.toLocaleString('en-IN')}</div>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 flex-1 min-w-[120px]">
            <div className="text-xs text-slate-500 mb-0.5">Transactions</div>
            <div className="text-lg font-extrabold text-white">{expenses.length}</div>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 flex-1 min-w-[120px]">
            <div className="text-xs text-slate-500 mb-0.5">Members</div>
            <div className="text-lg font-extrabold text-white">{group.members.length}</div>
          </div>
        </div>
      )}

      {/* Expense list */}
      {sorted.length > 0 ? (
        <div className="space-y-3">
          {sorted.map(expense => {
            const payer = getMember(expense.paidBy);
            const cat = CATEGORY_META[expense.category];
            return (
              <div key={expense.id} className="group relative rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4 transition-all hover:border-white/15 hover:bg-white/[0.05]">
                <div className="flex items-start gap-3">
                  {/* Category icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: cat.color + '20' }}>
                    {cat.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{expense.description}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Paid by{' '}
                          <span className="font-semibold" style={{ color: payer?.color }}>
                            {payer?.name ?? 'Unknown'}
                          </span>
                          {' • '}
                          <span className="capitalize">
                            {expense.splitType === 'equal' ? `Split equally · ₹${(expense.amount / expense.splits.length).toFixed(0)} each` :
                             expense.splitType === 'percentage' ? 'Percentage split' : 'Custom split'}
                          </span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-extrabold text-white">₹{expense.amount.toLocaleString('en-IN')}</div>
                        <div className="text-xs text-slate-500">{timeAgo(expense.createdAt)}</div>
                      </div>
                    </div>
                    {/* Split pills */}
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
                <button
                  onClick={() => deleteExpense(expense.id)}
                  className="absolute right-3 top-3 hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 text-5xl">🧾</div>
          <h3 className="text-lg font-bold text-white">No expenses yet</h3>
          <p className="mt-1 text-sm text-slate-400">Add your first expense to get started</p>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-[0_8px_32px_rgba(99,102,241,0.5)] hover:bg-indigo-500 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(99,102,241,0.6)] z-30"
      >
        <Plus className="h-5 w-5" /> Add Expense
      </button>

      {showAdd && <AddExpenseModal groupId={id} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
