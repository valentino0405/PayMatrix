'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useStore, Member } from '@/lib/store';
import { ArrowLeft, Globe, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import { calculateSettlements } from '@/lib/settlement';

export default function GlobalSettlePage() {
  const { groups, getNetBalances } = useStore();

  const { transactions, metrics } = useMemo(() => {
    // 1. Accumulate net balances across all groups using Email (or fallback to Name)
    const globalBalances: Record<string, number> = {};
    const nameMap: Record<string, { email: string; name: string; color: string }> = {};

    let totalDebtBefore = 0;

    groups.forEach(group => {
      const balances = getNetBalances(group.id);
      
      // Calculate local debt for metrics (sum of all positive balances)
      let localDebt = 0;
      Object.values(balances).forEach(b => { if (b > 0) localDebt += b; });
      totalDebtBefore += localDebt;

      // Merge into global
      group.members.forEach(m => {
        const net = balances[m.id] || 0;
        if (Math.abs(net) < 0.01) return;

        // Identity resolution: prefer email, fallback to name
        const identity = m.email?.trim().toLowerCase() || m.name.trim().toLowerCase();
        
        globalBalances[identity] = (globalBalances[identity] || 0) + net;
        if (!nameMap[identity]) {
          nameMap[identity] = { email: m.email || '', name: m.name, color: m.color };
        }
      });
    });

    // 2. Format for the settlement engine
    const globalMembers: Member[] = Object.keys(globalBalances).map(id => ({
      id,
      name: nameMap[id].name + (nameMap[id].email ? ` (${nameMap[id].email})` : ''),
      color: nameMap[id].color,
    }));

    const txns = calculateSettlements(globalBalances, globalMembers);

    // Calculate new total debt volume
    const totalDebtAfter = txns.reduce((s, t) => s + t.amount, 0);
    const savings = totalDebtBefore - totalDebtAfter;

    return { 
      transactions: txns, 
      metrics: { before: totalDebtBefore, after: totalDebtAfter, savings, txnCount: txns.length }
    };
  }, [groups, getNetBalances]);


  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-emerald-700/15 blur-[120px]" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07070f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-4 px-5">
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-emerald-400" />
            <h1 className="text-lg font-bold">Global Optimization</h1>
          </div>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <div className="mb-8">
          <p className="text-sm text-slate-400 max-w-2xl">
            This engine combines your debts across all groups using Email Addresses. 
            If you owe ₹500 in Group A, but are owed ₹300 in Group B, we cancel it out so you only pay ₹200.
          </p>
        </div>

        {/* METRICS */}
        <div className="grid gap-4 sm:grid-cols-3 mb-10">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Old Payout Volume</div>
            <div className="text-2xl font-extrabold text-slate-300">₹{metrics.before.toLocaleString('en-IN')}</div>
            <div className="text-xs text-slate-500 mt-1">If settled per-group</div>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 relative overflow-hidden">
            <ShieldCheck className="absolute -right-4 -bottom-4 h-24 w-24 text-emerald-500/10" />
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Globally Optimized</div>
            <div className="text-2xl font-extrabold text-emerald-400">₹{metrics.after.toLocaleString('en-IN')}</div>
            <div className="text-xs text-emerald-500 mt-1">Total money actually changing hands</div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Saved Volume</div>
            <div className="text-2xl font-extrabold text-white">₹{metrics.savings.toLocaleString('en-IN')}</div>
            <div className="text-xs text-slate-500 mt-1">Cancelled out automatically</div>
          </div>
        </div>

        <h2 className="text-base font-bold mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-400" />
          Optimal Global Payouts ({metrics.txnCount})
        </h2>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center rounded-3xl border border-white/[0.07] bg-white/[0.02]">
            <div className="text-5xl mb-4">🙌</div>
            <h3 className="text-xl font-bold text-emerald-400">Everyone is fully settled!</h3>
            <p className="mt-2 text-slate-400 max-w-sm">There are no outstanding debts across any of your groups.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((txn, i) => {
              // Extract names by discarding the email part (id is either email or name)
              const fromLabel = txn.from;
              const toLabel = txn.to;

              return (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4 sm:p-5 transition-all hover:bg-white/[0.06]">
                  <div className="flex flex-1 items-center gap-2 sm:gap-4">
                    {/* Payee */}
                    <div className="flex-1 text-right">
                      <div className="text-sm font-bold text-white truncate">{fromLabel}</div>
                      <div className="text-xs text-rose-400 font-semibold mt-0.5">Pays</div>
                    </div>
                    {/* Arrow */}
                    <div className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    {/* Receiver */}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-bold text-white truncate">{toLabel}</div>
                      <div className="text-xs text-emerald-400 font-semibold mt-0.5">Receives</div>
                    </div>
                  </div>
                  {/* Amount */}
                  <div className="ml-4 shrink-0 text-right">
                    <div className="text-lg sm:text-xl font-extrabold text-white">₹{txn.amount.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
