'use client';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
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

export default function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const { getGroup, getGroupExpenses } = useStore();
  const group = getGroup(id);
  const expenses = getGroupExpenses(id);

  // ── Category breakdown ─────────────────────────────────────────────────────
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // ── Member contributions ───────────────────────────────────────────────────
  const memberData = useMemo(() => {
    if (!group) return [];
    return group.members.map(m => {
      const paid = expenses.filter(e => e.paidBy === m.id).reduce((s, e) => s + e.amount, 0);
      const owed = expenses.reduce((s, e) => {
        const split = e.splits.find(sp => sp.memberId === m.id);
        return s + (split?.amount || 0);
      }, 0);
      return { name: m.name, Paid: Math.round(paid), Owed: Math.round(owed), color: m.color };
    });
  }, [group, expenses]);

  // ── Monthly trend ──────────────────────────────────────────────────────────
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

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
  const avgPerExpense = expenses.length > 0 ? totalSpend / expenses.length : 0;
  const topCategory = categoryData[0];
  const biggestExpense = expenses.reduce((max, e) => e.amount > (max?.amount ?? 0) ? e : max, expenses[0]);

  if (!group) return null;

  return (
    <div className="space-y-6">
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
              {/* Legend */}
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

      {/* Monthly trend */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
        <h3 className="text-sm font-bold text-white mb-4">📈 Monthly Spending Trend</h3>
        {monthlyData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No expenses yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="total" name="Spend" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top expenses table */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
        <h3 className="text-sm font-bold text-white mb-4">🧾 Top Expenses</h3>
        {expenses.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-8">No expenses yet</div>
        ) : (
          <div className="space-y-2">
            {[...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5).map((e, i) => {
              const payer = group.members.find(m => m.id === e.paidBy);
              return (
                <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5 transition-colors">
                  <span className="text-slate-500 text-xs w-4 text-right shrink-0">#{i + 1}</span>
                  <span className="text-base shrink-0">{CATEGORY_EMOJI[e.category]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{e.description}</p>
                    <p className="text-xs text-slate-500">
                      Paid by <span style={{ color: payer?.color }}>{payer?.name}</span>
                      {' · '}{new Date(e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-white shrink-0">₹{e.amount.toLocaleString('en-IN')}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
