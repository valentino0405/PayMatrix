'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Zap, ArrowRight, Check, TrendingDown, Users, Receipt, DollarSign, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { calculateSettlements, naiveTransactionCount, Transaction } from '@/lib/settlement';

interface PaidRecord { from: string; to: string; amount: number; }

export default function SettlePage() {
  const { id } = useParams<{ id: string }>();
  const { getGroup, getGroupExpenses, getNetBalances } = useStore();
  const [optimized, setOptimized] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [paidRecords, setPaidRecords] = useState<PaidRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const group = getGroup(id);
  const expenses = getGroupExpenses(id);
  if (!group) return null;

  const netBalances = getNetBalances(id);
  const transactions: Transaction[] = calculateSettlements(netBalances, group.members);
  const naive = naiveTransactionCount(netBalances);
  const optimizedCount = transactions.length;
  const reduction = naive > 0 ? Math.round(((naive - optimizedCount) / naive) * 100) : 0;
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  const getMember = (mid: string) => group.members.find(m => m.id === mid);

  // ── Fetch existing paid records from MongoDB ────────────────────────────────
  useEffect(() => {
    fetch(`/api/groups/${id}/settlements`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setPaidRecords(data.map((r: { from: string; to: string; amount: number }) => ({ from: r.from, to: r.to, amount: r.amount })));
        // Auto-show the optimized view if there are settlements
        if (data.length > 0) setOptimized(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const isPaid = (txn: Transaction) =>
    paidRecords.some(r => r.from === txn.from && r.to === txn.to && r.amount === txn.amount);

  const handleOptimize = () => {
    if (optimized) return;
    setAnimating(true);
    setTimeout(() => { setOptimized(true); setAnimating(false); }, 800);
  };

  const togglePaid = async (txn: Transaction) => {
    const key = `${txn.from}-${txn.to}-${txn.amount}`;
    setSaving(key);
    const alreadyPaid = isPaid(txn);
    try {
      if (alreadyPaid) {
        await fetch(`/api/groups/${id}/settlements`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: txn.from, to: txn.to, amount: txn.amount }),
        });
        setPaidRecords(p => p.filter(r => !(r.from === txn.from && r.to === txn.to && r.amount === txn.amount)));
      } else {
        await fetch(`/api/groups/${id}/settlements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: txn.from, to: txn.to, amount: txn.amount }),
        });
        setPaidRecords(p => [...p, { from: txn.from, to: txn.to, amount: txn.amount }]);
      }
    } catch (err) { console.error(err); }
    finally { setSaving(null); }
  };

  const allSettled = transactions.length > 0 && transactions.every(isPaid);
  const settledCount = transactions.filter(isPaid).length;

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
      <p className="text-slate-400 text-sm">Loading settlement records...</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20 border border-indigo-500/30 mb-4">
          <Zap className="h-8 w-8 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-white">Settlement Optimizer</h2>
        <p className="mt-1 text-slate-400 text-sm">Min-Cash-Flow algorithm · Payments saved to database</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: 'People', value: group.members.length, color: 'text-indigo-400' },
          { icon: DollarSign, label: 'Total', value: `₹${totalAmount.toLocaleString('en-IN')}`, color: 'text-emerald-400' },
          { icon: Receipt, label: 'Expenses', value: expenses.length, color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4 text-center">
            <s.icon className={`mx-auto mb-1 h-4 w-4 ${s.color}`} />
            <div className="text-lg font-extrabold text-white">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {!optimized ? (
        <>
          <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Without Optimization</span>
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-bold text-rose-400">UNOPTIMIZED</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-4xl font-black text-rose-400">{naive}</div>
              <div className="text-sm text-slate-400">potential transactions<br /><span className="text-slate-500 text-xs">Each debtor pays each creditor directly</span></div>
            </div>
          </div>

          <button onClick={handleOptimize} disabled={animating || transactions.length === 0}
            className={`w-full rounded-2xl py-4 text-base font-extrabold transition-all ${animating ? 'bg-indigo-600/50 text-indigo-300 cursor-wait' : transactions.length === 0 ? 'bg-white/5 text-slate-400 border border-white/10 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] hover:-translate-y-0.5'}`}>
            {animating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Optimizing...
              </span>
            ) : transactions.length === 0 ? '✅ Everyone is settled up!' : (
              <span className="flex items-center justify-center gap-2"><Zap className="h-5 w-5" /> ⚡ Optimize Settlements</span>
            )}
          </button>

          {transactions.length === 0 && (
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-5 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <p className="font-bold text-emerald-400">All debts are settled!</p>
              <p className="text-sm text-slate-400 mt-1">No transactions needed.</p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Before vs After */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-center">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Before</div>
              <div className="text-3xl font-black text-rose-400">{naive}</div>
              <div className="text-xs text-slate-400">transactions</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-center">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">After ⚡</div>
              <div className="text-3xl font-black text-emerald-400">{optimizedCount}</div>
              <div className="text-xs text-slate-400">transactions</div>
            </div>
          </div>

          {reduction > 0 && (
            <div className="mb-5 flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.07] px-4 py-3">
              <TrendingDown className="h-5 w-5 text-indigo-400" />
              <span className="text-indigo-300 font-bold">{reduction}% fewer transactions</span>
              <span className="text-slate-400 text-sm">— saving {naive - optimizedCount} payments</span>
            </div>
          )}

          {/* Progress bar */}
          {transactions.length > 0 && (
            <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-400 font-semibold">Settlement Progress</span>
                <span className="text-white font-bold">{settledCount} / {transactions.length} paid</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${transactions.length > 0 ? (settledCount / transactions.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {allSettled && transactions.length > 0 && (
            <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4 text-center">
              <div className="text-2xl mb-1">🎉</div>
              <p className="font-bold text-emerald-400">All transactions settled! Saved to database.</p>
            </div>
          )}

          {/* Transactions */}
          <div className="space-y-3">
            {transactions.map((txn, i) => {
              const from = getMember(txn.from);
              const to = getMember(txn.to);
              const txnKey = `${txn.from}-${txn.to}-${txn.amount}`;
              const isSettled = isPaid(txn);
              const isSaving = saving === txnKey;

              return (
                <div key={txnKey}
                  className={`rounded-2xl border p-4 transition-all ${isSettled ? 'border-emerald-500/20 bg-emerald-500/[0.04] opacity-70' : 'border-white/[0.08] bg-white/[0.04] hover:border-white/15'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isSettled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                      {isSettled ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: from?.color }}>{from?.name.charAt(0)}</div>
                      <span className="font-semibold text-white text-sm">{from?.name}</span>
                    </div>
                    <div className="flex flex-1 items-center gap-1 justify-center">
                      <div className="h-px flex-1 bg-gradient-to-r from-rose-500/50 to-emerald-500/50" />
                      <div className="shrink-0 px-2 text-center">
                        <div className="text-base font-extrabold text-white">₹{txn.amount.toFixed(0)}</div>
                        <ArrowRight className="h-4 w-4 text-slate-400 mx-auto" />
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/50 to-emerald-500/20" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{to?.name}</span>
                      <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: to?.color }}>{to?.name.charAt(0)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      <span style={{ color: from?.color }}>{from?.name}</span> pays <span style={{ color: to?.color }}>{to?.name}</span> ₹{txn.amount.toFixed(2)}
                      {isSettled && <span className="ml-2 text-emerald-400 font-semibold">· Saved to DB ✓</span>}
                    </p>
                    <button onClick={() => togglePaid(txn)} disabled={isSaving}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${isSettled ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10'}`}>
                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      {isSettled ? 'Settled ✓' : 'Mark Paid'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={() => { setOptimized(false); }}
            className="mt-4 w-full rounded-xl border border-white/10 py-2.5 text-sm text-slate-400 hover:bg-white/5 transition-all">
            ↺ Reset View
          </button>
        </>
      )}
    </div>
  );
}
