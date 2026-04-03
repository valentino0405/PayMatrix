'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Users, Zap, X, ArrowRight, Sparkles, Receipt, TrendingUp } from 'lucide-react';
import { useStore, GroupType, MEMBER_COLORS } from '@/lib/store';

const GROUP_TYPES: GroupType[] = ['Trip', 'Roommates', 'Event', 'Other'];
const TYPE_EMOJI: Record<GroupType, string> = { Trip: '✈️', Roommates: '🏠', Event: '🎉', Other: '💼' };

function Avatar({ name, color, size = 8 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full text-white font-bold text-xs`}
      style={{ backgroundColor: color, width: size * 4, height: size * 4, fontSize: size < 8 ? 10 : 12 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const { addGroup } = useStore();
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<GroupType>('Trip');
  const [members, setMembers] = useState(['', '']);

  const handleAddMember = () => setMembers(p => [...p, '']);
  const handleMemberChange = (i: number, val: string) => setMembers(p => p.map((m, idx) => idx === i ? val : m));
  const handleRemoveMember = (i: number) => setMembers(p => p.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const validMembers = members.filter(m => m.trim());
    if (validMembers.length < 2) return alert('Add at least 2 members');
    const group = addGroup({ name: name.trim(), type, memberNames: validMembers });
    onClose();
    router.push(`/groups/${group.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.07]">
          <h2 className="text-lg font-bold text-white">Create New Group</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Group Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Goa Trip 🌊"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Group Type</label>
            <div className="grid grid-cols-4 gap-2">
              {GROUP_TYPES.map(t => (
                <button
                  key={t} type="button" onClick={() => setType(t)}
                  className={`rounded-xl py-2 text-xs font-semibold transition-all border ${type === t ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  <div className="text-base mb-0.5">{TYPE_EMOJI[t]}</div>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Members</label>
            <div className="space-y-2">
              {members.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold" style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>
                    {m ? m.charAt(0).toUpperCase() : '?'}
                  </div>
                  <input
                    value={m}
                    onChange={e => handleMemberChange(i, e.target.value)}
                    placeholder={`Member ${i + 1} name`}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 transition-all"
                  />
                  {members.length > 2 && (
                    <button type="button" onClick={() => handleRemoveMember(i)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={handleAddMember} className="mt-2 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add member
            </button>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          >
            Create Group →
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { groups, expenses, loadDemo } = useStore();
  const [showCreate, setShowCreate] = useState(false);

  const totalExpenses = expenses.length;
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      {/* Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-700/15 blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07070f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-lg font-bold">
            <span className="text-indigo-400">Pay</span><span className="text-emerald-400">Matrix</span>
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          >
            <Plus className="h-4 w-4" /> New Group
          </button>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        {/* Header stats */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-white">My Groups</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your shared expenses and settle up</p>
        </div>

        {groups.length > 0 && (
          <div className="mb-8 grid grid-cols-3 gap-4">
            {[
              { label: 'Total Groups', value: groups.length, icon: Users, color: 'text-indigo-400' },
              { label: 'Total Expenses', value: totalExpenses, icon: Receipt, color: 'text-emerald-400' },
              { label: 'Total Amount', value: `₹${totalAmount.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-violet-400' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                <div className={`mb-1 ${s.color}`}><s.icon className="h-4 w-4" /></div>
                <div className="text-xl font-extrabold text-white">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Groups grid */}
        {groups.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map(group => {
              const gExpenses = expenses.filter(e => e.groupId === group.id);
              const total = gExpenses.reduce((s, e) => s + e.amount, 0);
              return (
                <Link key={group.id} href={`/groups/${group.id}`} className="group block">
                  <div className="h-full rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 transition-all hover:border-indigo-500/40 hover:bg-white/[0.06] hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(99,102,241,0.15)]">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className="text-xl">{TYPE_EMOJI[group.type]}</span>
                        <h3 className="mt-1 text-base font-bold text-white group-hover:text-indigo-300 transition-colors">{group.name}</h3>
                        <span className="mt-0.5 inline-block rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">{group.type}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <div className="flex items-center gap-1.5 mb-4">
                      {group.members.slice(0, 5).map(m => (
                        <Avatar key={m.id} name={m.name} color={m.color} size={7} />
                      ))}
                      {group.members.length > 5 && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs text-slate-400">
                          +{group.members.length - 5}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{group.members.length} members • {gExpenses.length} expenses</span>
                      <span className="font-bold text-white">₹{total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
              <Users className="h-10 w-10 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">No groups yet</h2>
            <p className="mt-2 max-w-sm text-slate-400">Create your first group to start splitting expenses and tracking who owes who.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all"
              >
                <Plus className="h-4 w-4" /> Create Group
              </button>
              <button
                onClick={loadDemo}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all"
              >
                <Sparkles className="h-4 w-4" /> Load Demo Data
              </button>
            </div>
          </div>
        )}

        {/* Demo button when groups exist */}
        {groups.length > 0 && (
          <div className="mt-6 text-center">
            <button onClick={loadDemo} className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1 mx-auto">
              <Sparkles className="h-3 w-3" /> Reset with demo data
            </button>
          </div>
        )}
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
