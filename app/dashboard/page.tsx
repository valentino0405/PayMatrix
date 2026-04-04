'use client';
import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Users, X, ArrowRight, Receipt, TrendingUp, Loader2 } from 'lucide-react';
import { useStore, GroupType, MEMBER_COLORS } from '@/lib/store';

const GROUP_TYPES: GroupType[] = ['Trip', 'Roommates', 'Event', 'Other'];
const TYPE_EMOJI: Record<GroupType, string> = { Trip: '✈️', Roommates: '🏠', Event: '🎉', Other: '💼' };

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const { addGroup } = useStore();
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<GroupType>('Trip');
  const [members, setMembers] = useState(['', '']);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const valid = members.filter(m => m.trim());
    if (valid.length < 2) return alert('Add at least 2 members');
    setBusy(true);
    try {
      const group = await addGroup({ name: name.trim(), type, memberNames: valid });
      onClose();
      router.push(`/groups/${group.id}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.07]">
          <h2 className="text-lg font-bold text-white">Create New Group</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Group Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Goa Trip 🌊"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {GROUP_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`rounded-xl py-2 text-xs font-semibold border transition-all ${type === t ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                  <div className="text-base mb-0.5">{TYPE_EMOJI[t]}</div>{t}
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
                    {m ? m[0].toUpperCase() : '?'}
                  </div>
                  <input value={m} onChange={e => setMembers(p => p.map((x, j) => j === i ? e.target.value : x))} placeholder={`Member ${i + 1}`}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 transition-all" />
                  {members.length > 2 && (
                    <button type="button" onClick={() => setMembers(p => p.filter((_, j) => j !== i))}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setMembers(p => [...p, ''])} className="mt-2 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add member
            </button>
          </div>
          <button type="submit" disabled={busy}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Creating...</> : 'Create Group →'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { groups, expenses, loading } = useStore();
  const [showCreate, setShowCreate] = useState(false);

  // Sync Clerk user → MongoDB whenever dashboard mounts
  useEffect(() => {
    fetch('/api/users/sync', { method: 'POST' }).catch(() => {});
  }, []);

  const totalExpenses = expenses.length;
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-125 h-125 rounded-full bg-indigo-700/15 blur-[120px]" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07070f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-lg font-bold"><span className="text-indigo-400">Pay</span><span className="text-emerald-400">Matrix</span></Link>
          <div className='flex space-x-1.5'>
            <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            <Plus className="h-4 w-4" /> New Group
          </button>
            <UserButton
                showName
                appearance={{
                  variables: {
                    colorBackground: "#111118",
                    colorText: "#ffffff",
                    colorTextSecondary: "#94a3b8",
                    colorPrimary: "#4f46e5",
                    borderRadius: "0.75rem",
                  },
                  elements: {
                    userButtonBox: "gap-2",
                    userButtonOuterIdentifier:
                      "text-sm font-semibold !text-white",
                    userButtonTrigger:
                      "h-9 rounded-xl border border-white/10 bg-white/5 px-2 text-white hover:bg-white/10 transition-all shadow-none focus:shadow-none focus:ring-0",
                    userButtonAvatarBox:
                      "h-7 w-7 rounded-full border border-white/10",
                    userButtonPopoverCard:
                      "rounded-2xl border border-white/[0.07] bg-[#111118] !text-white shadow-2xl",
                    userButtonPopoverActions: "gap-1 p-2",
                    userButtonPopoverActionButton:
                      "rounded-xl border border-transparent bg-transparent !text-white hover:bg-white/10 hover:border-white/10 active:bg-white/10",
                    userButtonPopoverActionButtonText:
                      "text-sm font-semibold !text-white",
                    userButtonPopoverActionButtonIcon: "!text-slate-400",
                    userPreviewMainIdentifier:
                      "text-sm font-semibold !text-white",
                    userPreviewSecondaryIdentifier: "text-xs !text-slate-400",
                    userButtonPopoverMain: "!text-white",
                    userButtonPopoverActionButton__manageAccount:
                      "rounded-xl border border-transparent bg-transparent !text-white hover:bg-white/10 hover:border-white/10 active:bg-white/10",
                    userButtonPopoverActionButton__signOut:
                      "rounded-xl border border-transparent bg-transparent !text-white hover:bg-white/10 hover:border-white/10 active:bg-white/10",
                    userButtonPopoverFooter: "hidden",
                  },
                }}
              />
          </div>
          
        </div>
      </nav>

      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold">My Groups</h1>
          <p className="mt-1 text-sm text-slate-500">Manage shared expenses — data saved to MongoDB</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
            <p className="text-slate-400 text-sm">Loading your groups from database...</p>
          </div>
        ) : groups.length > 0 ? (
          <>
            <div className="mb-8 grid grid-cols-3 gap-4">
              {[
                { label: 'Groups',   value: groups.length,                              icon: Users,      color: 'text-indigo-400'  },
                { label: 'Expenses', value: totalExpenses,                              icon: Receipt,    color: 'text-emerald-400' },
                { label: 'Total',    value: `₹${totalAmount.toLocaleString('en-IN')}`,  icon: TrendingUp, color: 'text-violet-400'  },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                  <div className={`mb-1 ${s.color}`}><s.icon className="h-4 w-4" /></div>
                  <div className="text-xl font-extrabold">{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map(group => {
                const ge = expenses.filter(e => e.groupId === group.id);
                const total = ge.reduce((s, e) => s + e.amount, 0);
                return (
                  <Link key={group.id} href={`/groups/${group.id}`} className="group block">
                    <div className="h-full rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 transition-all hover:border-indigo-500/40 hover:bg-white/6 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(99,102,241,0.15)]">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <span className="text-xl">{TYPE_EMOJI[group.type]}</span>
                          <h3 className="mt-1 text-base font-bold group-hover:text-indigo-300 transition-colors">{group.name}</h3>
                          <span className="mt-0.5 inline-block rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">{group.type}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </div>
                      <div className="flex items-center gap-1.5 mb-4">
                        {group.members.slice(0, 5).map(m => (
                          <div key={m.id} className="flex h-7 w-7 items-center justify-center rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: m.color }}>{m.name[0]}</div>
                        ))}
                        {group.members.length > 5 && <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs text-slate-400">+{group.members.length - 5}</div>}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">{group.members.length} members · {ge.length} expenses</span>
                        <span className="font-bold">₹{total.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
              <Users className="h-10 w-10 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold">No groups yet</h2>
            <p className="mt-2 max-w-sm text-slate-400">Create your first group — it will be saved to MongoDB instantly.</p>
            <button onClick={() => setShowCreate(true)}
              className="mt-8 flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold hover:bg-indigo-500 transition-all">
              <Plus className="h-4 w-4" /> Create Group
            </button>
          </div>
        )}
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
