'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function BalancesPage() {
  const { id } = useParams<{ id: string }>();
  const { getGroup, getNetBalances } = useStore();
  const group = getGroup(id);
  if (!group) return null;

  const balances = getNetBalances(id);
  const entries = group.members
    .map(m => ({ member: m, net: Math.round((balances[m.id] ?? 0) * 100) / 100 }))
    .sort((a, b) => b.net - a.net);

  const totalOwed = entries.filter(e => e.net > 0.01).reduce((s, e) => s + e.net, 0);
  const totalOwing = entries.filter(e => e.net < -0.01).reduce((s, e) => s + Math.abs(e.net), 0);
  const settled = entries.filter(e => Math.abs(e.net) <= 0.01).length;

  return (
    <div>
      {/* Summary */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4 text-center">
          <TrendingUp className="mx-auto mb-1 h-5 w-5 text-emerald-400" />
          <div className="text-lg font-extrabold text-emerald-400">₹{totalOwed.toFixed(0)}</div>
          <div className="text-xs text-slate-500">Total owed to others</div>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.07] p-4 text-center">
          <TrendingDown className="mx-auto mb-1 h-5 w-5 text-rose-400" />
          <div className="text-lg font-extrabold text-rose-400">₹{totalOwing.toFixed(0)}</div>
          <div className="text-xs text-slate-500">Total owing to others</div>
        </div>
        <div className="rounded-2xl border border-slate-500/20 bg-slate-500/[0.07] p-4 text-center">
          <Minus className="mx-auto mb-1 h-5 w-5 text-slate-400" />
          <div className="text-lg font-extrabold text-slate-400">{settled}</div>
          <div className="text-xs text-slate-500">Settled up</div>
        </div>
      </div>

      {/* Balance cards */}
      <div className="space-y-3">
        {entries.map(({ member, net }) => {
          const isPositive = net > 0.01;
          const isNegative = net < -0.01;
          const settled = Math.abs(net) <= 0.01;
          return (
            <div
              key={member.id}
              className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                isPositive ? 'border-emerald-500/20 bg-emerald-500/[0.05]' :
                isNegative ? 'border-rose-500/20 bg-rose-500/[0.05]' :
                'border-white/[0.07] bg-white/[0.02]'
              }`}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white text-base font-extrabold ring-2"
                style={{ backgroundColor: member.color, ['--tw-ring-color' as string]: member.color + '40' } as React.CSSProperties}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-bold text-white">{member.name}</p>
                <p className={`text-sm ${isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'}`}>
                  {isPositive ? `Gets back ₹${net.toFixed(2)}` :
                   isNegative ? `Owes ₹${Math.abs(net).toFixed(2)}` :
                   'All settled up ✓'}
                </p>
              </div>
              <div className="text-right">
                <div className={`text-xl font-extrabold ${isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-500'}`}>
                  {isPositive ? '+' : ''}{net.toFixed(2)}
                </div>
                {!settled && (
                  <div className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isPositive ? 'RECEIVES' : 'PAYS'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA to settle */}
      {entries.some(e => Math.abs(e.net) > 0.01) && (
        <div className="mt-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.07] p-5 text-center">
          <p className="text-slate-300 text-sm mb-3">Ready to settle? Use our optimizer to minimize transactions.</p>
          <Link
            href={`/groups/${id}/settle`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          >
            <Zap className="h-4 w-4" /> Optimize Settlements
          </Link>
        </div>
      )}
    </div>
  );
}
