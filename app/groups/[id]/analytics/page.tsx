'use client';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Sparkles, AlertTriangle, TrendingUp, CalendarDays, Trophy, Flame, Wallet, Edit2, Loader2, Frown } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#f59e0b', Travel: '#3b82f6', Accommodation: '#8b5cf6',
  Entertainment: '#ec4899', Shopping: '#10b981',
  Utilities: '#f97316', Health: '#ef4444', Other: '#6366f1',
};
const CATEGORY_EMOJI: Record<string, string> = {
  Food: '🍕', Travel: '✈️', Accommodation: '🏠', Entertainment: '🎉',
  Shopping: '🛍️', Utilities: '💡', Health: '💊', Other: '💼',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#111118] px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-white">{payload[0].name}</p>
      <p className="text-slate-300">₹{payload[0].value.toLocaleString('en-IN')}</p>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#111118] px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-slate-300 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: ₹{p.value.toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  );
};

function BudgetModal({ initialBudget, onClose, onSave }: { initialBudget?: number, onClose: () => void, onSave: (b: number | undefined) => Promise<void> }) {
  const [val, setVal] = useState(initialBudget?.toString() || '');
  const [busy, setBusy] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const parsed = parseFloat(val);
      await onSave(isNaN(parsed) || parsed <= 0 ? undefined : parsed);
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#111118] p-5 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-3">Set Monthly Budget</h3>
        <form onSubmit={handleSave}>
          <input autoFocus type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="e.g. 10000" min="0" step="100"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 mb-4 font-bold text-lg" />
          <p className="text-xs text-slate-400 leading-snug mb-4">Leave empty to remove the budget tracking.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/10">Cancel</button>
            <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
              {busy ? 'Saving...' : 'Save Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  
  // MERGED STORE STATE
  const { getGroup, getGroupExpenses, getGroupSettlements, getGroupPayments, updateGroupBudget } = useStore();
  const [viewMode, setViewMode] = useState<'initial' | 'current'>('initial');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  
  const group = getGroup(id);
  const expenses = getGroupExpenses(id);
  const settlements = getGroupSettlements(id);
  const payments = getGroupPayments(id);

  // ── Category breakdown ─────────────────────────────────────────────────────
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // ── Member contributions & Gamification ────────────────────────────────────
  const { memberData, gamification } = useMemo<{ memberData: any[], gamification: { topSpender: any, mvpSaver: any }}>(() => {
    if (!group) return { memberData: [], gamification: { topSpender: null, mvpSaver: null } };
    let topSpender = null;
    let mvpSaver = null;
    let maxPaid = -1;
    let maxSumOwedToThem = -1; 

    const md = group.members.map(m => {
      let paid = expenses.filter(e => e.paidBy === m.id).reduce((s, e) => s + e.amount, 0);
      let owed = expenses.reduce((s, e) => {
        const split = e.splits.find(sp => sp.memberId === m.id);
        return s + (split?.amount || 0);
      }, 0);

      // Superlatives logic triggers based on initial debts
      if (paid > maxPaid) { maxPaid = paid; topSpender = m; }
      
      const net = paid - owed;
      if (net > maxSumOwedToThem) { maxSumOwedToThem = net; mvpSaver = m; }

      // View Mode Toggle (Net off settlements if enabled)
      if (viewMode === 'current') {
        const manualSettlementPaid = settlements.filter(s => s.from === m.id && !s.paymentTransactionId).reduce((s, e) => s + e.amount, 0);
        const manualSettlementReceived = settlements.filter(s => s.to === m.id && !s.paymentTransactionId).reduce((s, e) => s + e.amount, 0);
        const realPaymentPaid = payments.filter(p => p.from === m.id && p.status === 'success').reduce((s, e) => s + e.amount, 0);
        const realPaymentReceived = payments.filter(p => p.to === m.id && p.status === 'success').reduce((s, e) => s + e.amount, 0);

        owed -= (manualSettlementPaid + realPaymentPaid);
        paid -= (manualSettlementReceived + realPaymentReceived);
      }

      return { name: m.name, Paid: Math.max(0, Math.round(paid)), Owed: Math.max(0, Math.round(owed)), color: m.color };
    });

    return { 
      memberData: md, 
      gamification: {
        topSpender: maxPaid > 0 ? topSpender : null,
        mvpSaver: maxSumOwedToThem > 0 ? mvpSaver : null
      }
    };
  }, [group, expenses, settlements, payments, viewMode]);

  // ── Monthly trend & Predictor ──────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      const month = new Date(e.createdAt).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      map[month] = (map[month] || 0) + e.amount;
    });
    return Object.entries(map)
      .map(([month, total]) => ({ month, total: Math.round(total) }))
      .slice(-6); // last 6 months
  }, [expenses]);

  const prediction = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysElapsed = now.getDate() || 1; 

    let thisMonthTotal = 0;
    let lastMonthTotal = 0;

    expenses.forEach(e => {
      const d = new Date(e.createdAt);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        thisMonthTotal += e.amount;
      } else if (d.getFullYear() === (currentMonth === 0 ? currentYear - 1 : currentYear) &&
                 d.getMonth() === (currentMonth === 0 ? 11 : currentMonth - 1)) {
        lastMonthTotal += e.amount;
      }
    });

    const projected = Math.round((thisMonthTotal / daysElapsed) * daysInMonth);
    const differenceLastMonth = lastMonthTotal > 0 ? ((projected - lastMonthTotal) / lastMonthTotal) * 100 : 0;
    
    return {
      thisMonthTotal, projected, lastMonthTotal,
      differenceLastMonth: Math.round(differenceLastMonth),
      isOverspending: differenceLastMonth > 10,
    };
  }, [expenses]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
  const avgPerExpense = expenses.length > 0 ? totalSpend / expenses.length : 0;
  const topCategory = categoryData[0];
  const biggestExpense = expenses.reduce((max, e) => e.amount > (max?.amount ?? 0) ? e : max, expenses[0]);
  const isTopCategoryWarning = topCategory && totalSpend > 0 && (topCategory.value / totalSpend) > 0.45;

  if (!group) return null;

  const budgetPct = group.monthlyBudget ? (prediction.thisMonthTotal / group.monthlyBudget) * 100 : 0;
  const isOverBudget = budgetPct >= 100;

  return (
    <div className="space-y-6">
      
      {/* ── View Toggle Module ─────────────────────────────────────────── */}
      <div className="flex justify-center mt-2 mb-2">
        <div className="inline-flex rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            onClick={() => setViewMode('initial')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'initial' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Original Structure
          </button>
          <button
            onClick={() => setViewMode('current')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'current' ? 'bg-emerald-500/20 text-emerald-300 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Current Scenario
          </button>
        </div>
      </div>

      {/* ── Budget & Gamification Row ──────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Budget Module */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 relative overflow-hidden transition-all hover:bg-white/4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Wallet className="h-4 w-4 text-emerald-400" /> Monthly Budget</h3>
            <button onClick={() => setShowBudgetModal(true)} className="flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </div>
          
          {group.monthlyBudget ? (
            <>
              <div className="flex items-end justify-between mb-1">
                <div className="text-2xl font-extrabold text-white">₹{prediction.thisMonthTotal.toLocaleString('en-IN')}</div>
                <div className="text-xs font-semibold text-slate-400 mb-1">of ₹{group.monthlyBudget.toLocaleString('en-IN')}</div>
              </div>
              <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${isOverBudget ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(budgetPct, 100)}%` }} />
              </div>
              {isOverBudget ? (
                <div className="mt-3 flex items-start gap-2 text-xs font-semibold text-rose-400 bg-rose-500/10 rounded-lg p-2.5 border border-rose-500/20">
                  <span className="shrink-0 animate-pulse mt-0.5"><AlertTriangle className="h-3.5 w-3.5" /></span>
                  Budget exceeded! You have spent {budgetPct.toFixed(0)}% of your allowance.
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-400">
                  You have <strong className="text-white">₹{(group.monthlyBudget - prediction.thisMonthTotal).toLocaleString('en-IN')}</strong> remaining this month.
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-20 border border-dashed border-white/20 rounded-xl bg-white/2">
              <button onClick={() => setShowBudgetModal(true)} className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">Set Monthly Budget</button>
              <p className="text-xs text-slate-500 mt-1">Get alerts on overspending</p>
            </div>
          )}
        </div>

        {/* Gamification Module */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-400" /> Group Superlatives</h3>
          {(gamification.mvpSaver || gamification.topSpender) ? (
            <div className="space-y-4">
              {gamification.mvpSaver && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">MVP Saver</div>
                    <div className="text-base font-bold text-white" style={{ color: gamification.mvpSaver.color }}>{gamification.mvpSaver.name}</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Covered the most expenses for others</div>
                  </div>
                </div>
              )}
              {gamification.topSpender && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Top Spender </div>
                    <div className="text-base font-bold text-white" style={{ color: gamification.topSpender.color }}>{gamification.topSpender.name}</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Dropped the biggest bags this trip</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 text-slate-500 text-xs text-center">Add more unequal expenses <br/>to unlock superlatives!</div>
          )}
        </div>
      </div>

      {/* ── Smart Insights Banner ────────────────────────────────────────── */}
      {(expenses.length > 0) && (
        <div className="rounded-2xl border border-indigo-500/20 bg-linear-to-r from-indigo-500/8 to-violet-500/4 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            <h3 className="text-base font-extrabold text-white tracking-wide">Smart Insights</h3>
          </div>
          
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Run Rate Predictor */}
            <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 p-4">
              <div className={`p-2 rounded-lg ${prediction.isOverspending ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {prediction.isOverspending ? <TrendingUp className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Run Rate Map</p>
                <div className="text-sm text-slate-200">
                  You are projected to spend <strong className="text-white">₹{prediction.projected.toLocaleString('en-IN')}</strong> this month.
                </div>
                {prediction.lastMonthTotal > 0 && (
                  <p className={`text-xs mt-1.5 font-semibold ${prediction.isOverspending ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {prediction.isOverspending ? `▲ ${prediction.differenceLastMonth}% higher` : `▼ ${Math.abs(prediction.differenceLastMonth)}% lower`} than last month's ₹{prediction.lastMonthTotal.toLocaleString('en-IN')}.
                  </p>
                )}
              </div>
            </div>

            {/* Category Suggestion */}
            {topCategory && (
              <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 p-4">
                <div className={`p-2 rounded-lg ${isTopCategoryWarning ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                  {isTopCategoryWarning ? <AlertTriangle className="h-4 w-4" /> : <PieChart className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Spending Habits</p>
                  <p className="text-sm text-slate-200">
                    Your highest spending is on <strong className="text-white">{CATEGORY_EMOJI[topCategory.name]} {topCategory.name}</strong> at ₹{topCategory.value.toLocaleString('en-IN')}.
                  </p>
                  {isTopCategoryWarning && (
                    <p className="text-xs mt-1.5 font-semibold text-amber-400">
                      💡 Insight: This consumes over {Math.round((topCategory.value / totalSpend) * 100)}% of your group's expenses.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Spent', value: `₹${totalSpend.toLocaleString('en-IN')}`, sub: `${expenses.length} expenses`, color: 'text-indigo-400' },
          { label: 'Avg/Expense', value: `₹${avgPerExpense.toFixed(0)}`, sub: 'per transaction', color: 'text-emerald-400' },
          { label: 'Top Category', value: topCategory ? `${CATEGORY_EMOJI[topCategory.name]} ${topCategory.name}` : '—', sub: topCategory ? `₹${topCategory.value.toLocaleString('en-IN')}` : 'no data', color: 'text-violet-400' },
          { label: 'Biggest Spend', value: biggestExpense ? `₹${biggestExpense.amount.toLocaleString('en-IN')}` : '—', sub: biggestExpense?.description ?? 'no data', color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
            <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${s.color}`}>{s.label}</div>
            <div className="text-lg font-extrabold text-white leading-tight">{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category Pie */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
          <h3 className="text-sm font-bold text-white mb-4">💰 Spending by Category</h3>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No expenses yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {categoryData.map(entry => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {categoryData.map(item => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[item.name] }} />
                    <span className="text-slate-400 truncate">{CATEGORY_EMOJI[item.name]} {item.name}</span>
                    <span className="text-white font-semibold ml-auto">₹{item.value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Member Contributions */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
          <h3 className="text-sm font-bold text-white mb-4">👥 Member Contributions</h3>
          {memberData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={memberData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                <Tooltip content={<BarTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar dataKey="Paid" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Owed" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      
      {showBudgetModal && <BudgetModal initialBudget={group.monthlyBudget} onClose={() => setShowBudgetModal(false)} onSave={async b => await updateGroupBudget(id, b)} />}
    </div>
  );
}
