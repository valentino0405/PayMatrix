'use client';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { calculateSettlements } from '@/lib/settlement';
import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const NODE_R = 28;
const W = 480;
const H = 420;
const CX = W / 2;
const CY = H / 2;
const ORBIT_R = 155;

function getNodePositions(count: number) {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return { x: CX + ORBIT_R * Math.cos(angle), y: CY + ORBIT_R * Math.sin(angle) };
  });
}

function Arrow({ x1, y1, x2, y2, amount, color, markerIndex }: { x1: number; y1: number; x2: number; y2: number; amount: number; color: string; markerIndex: number }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return null;
  const nx = dx / dist;
  const ny = dy / dist;

  const sx = x1 + nx * NODE_R;
  const sy = y1 + ny * NODE_R;
  const ex = x2 - nx * (NODE_R + 9);
  const ey = y2 - ny * (NODE_R + 9);

  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;

  // Slight curve offset
  const perp = { x: -ny * 18, y: nx * 18 };
  const cmx = mx + perp.x;
  const cmy = my + perp.y;

  const path = `M${sx},${sy} Q${cmx},${cmy} ${ex},${ey}`;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeOpacity={0.7}
        markerEnd={`url(#arrow-${markerIndex})`}
        className="transition-all"
      />
      {/* Amount label */}
      <text
        x={cmx}
        y={cmy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={11}
        fontWeight="700"
        className="select-none"
      >
        <tspan fill={color} fontWeight="800">₹{amount.toFixed(0)}</tspan>
      </text>
    </g>
  );
}

export default function GraphPage() {
  const { id } = useParams<{ id: string }>();
  const { getGroup, getNetBalances, refreshGroups } = useStore();
  const [viewMode, setViewMode] = useState<'initial' | 'current'>('initial');
  const [refreshing, setRefreshing] = useState(false);

  const group = getGroup(id);
  const netBalances = getNetBalances(id, viewMode === 'current');
  const transactions = useMemo(
    () => (group ? calculateSettlements(netBalances, group.members) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [group?.members.length, Object.values(netBalances).join(',')]
  );

  if (!group) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshGroups();
    } finally {
      setRefreshing(false);
    }
  };

  const positions = getNodePositions(group.members.length);
  const getMemberIndex = (mid: string) => group.members.findIndex(m => m.id === mid);


  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="text-center flex-1">
          <h2 className="text-xl font-extrabold text-white">Visual Debt Graph</h2>
          <p className="mt-1 text-sm text-slate-400">
            Nodes = people • Arrows = optimized payments • Direction shows who pays
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex justify-center mb-6">
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

      {group.members.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-slate-400">Add at least 2 members to see the debt graph</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-bold text-emerald-400 text-lg">All settled up!</p>
          <p className="text-slate-400 text-sm mt-1">No payment arrows to show — everyone is square.</p>
          {/* Still render the member nodes */}
          <div className="mt-6 w-full max-w-md mx-auto overflow-hidden rounded-2xl border border-white/[0.07] bg-white/2">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              {positions.map((pos, i) => {
                const m = group.members[i];
                return (
                  <g key={m.id}>
                    <circle cx={pos.x} cy={pos.y} r={NODE_R + 4} fill={m.color} fillOpacity={0.15} />
                    <circle cx={pos.x} cy={pos.y} r={NODE_R} fill={m.color} />
                    <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontWeight="800" fontSize={13}>{m.name.charAt(0)}</text>
                    <text x={pos.x} y={pos.y + NODE_R + 16} textAnchor="middle" fill="white" fontSize={11} fontWeight="600">{m.name}</text>
                    <text x={pos.x} y={pos.y + NODE_R + 30} textAnchor="middle" fill="#22c55e" fontSize={10} fontWeight="700">✓ Settled</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      ) : (
        <>
          {/* SVG Graph */}
          <div className="w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0d1a]">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              <defs>
                {group.members.map((m, idx) => (
                  <marker
                    key={m.id}
                    id={`arrow-${idx}`}
                    markerWidth="8" markerHeight="6"
                    refX="7" refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill={m.color} fillOpacity={0.9} />
                  </marker>
                ))}
              </defs>

              {/* Grid circles */}
              <circle cx={CX} cy={CY} r={ORBIT_R} stroke="white" strokeOpacity={0.04} strokeWidth={1} fill="none" />
              <circle cx={CX} cy={CY} r={10} fill="white" fillOpacity={0.03} />

              {/* Edges (arrows) */}
              {transactions.map((txn, i) => {
                const fromIdx = getMemberIndex(txn.from);
                const toIdx = getMemberIndex(txn.to);
                const fromPos = positions[fromIdx];
                const toPos = positions[toIdx];
                const fromMember = group.members[fromIdx];
                return fromPos && toPos ? (
                  <Arrow
                    key={i}
                    x1={fromPos.x} y1={fromPos.y}
                    x2={toPos.x} y2={toPos.y}
                    amount={txn.amount}
                    color={fromMember?.color ?? '#6366f1'}
                    markerIndex={fromIdx}
                  />
                ) : null;
              })}

              {/* Nodes */}
              {positions.map((pos, i) => {
                const m = group.members[i];
                const net = Math.round((netBalances[m.id] ?? 0) * 100) / 100;
                const isCreditor = net > 0.01;
                const isDebtor = net < -0.01;
                return (
                  <g key={m.id}>
                    {/* Glow ring */}
                    <circle
                      cx={pos.x} cy={pos.y}
                      r={NODE_R + 6}
                      fill={m.color}
                      fillOpacity={isCreditor ? 0.2 : isDebtor ? 0.1 : 0.08}
                    />
                    {/* Main circle */}
                    <circle cx={pos.x} cy={pos.y} r={NODE_R} fill={m.color} />
                    {/* Initials */}
                    <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontWeight="800" fontSize={14} className="select-none">
                      {m.name.charAt(0).toUpperCase()}
                    </text>
                    {/* Name label */}
                    <text x={pos.x} y={pos.y + NODE_R + 16} textAnchor="middle" fill="white" fontSize={11} fontWeight="700" className="select-none">
                      {m.name}
                    </text>
                    {/* Balance label */}
                    <text
                      x={pos.x} y={pos.y + NODE_R + 29}
                      textAnchor="middle"
                      fill={isCreditor ? '#34d399' : isDebtor ? '#f87171' : '#94a3b8'}
                      fontSize={10} fontWeight="600" className="select-none"
                    >
                      {isCreditor ? `+₹${net.toFixed(0)}` : isDebtor ? `-₹${Math.abs(net).toFixed(0)}` : '✓'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {transactions.map((txn, i) => {
              const from = group.members[getMemberIndex(txn.from)];
              const to = group.members[getMemberIndex(txn.to)];
              return (
                <div key={i} className="rounded-xl border border-white/[0.07] bg-white/3 p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[11px] font-bold" style={{ color: from?.color }}>{from?.name}</span>
                    <span className="text-slate-500 text-xs">→</span>
                    <span className="text-[11px] font-bold" style={{ color: to?.color }}>{to?.name}</span>
                  </div>
                  <div className="text-sm font-extrabold text-white">₹{txn.amount.toFixed(0)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
