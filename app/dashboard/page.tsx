'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Users, X, ArrowRight, Receipt, TrendingUp, Loader2,
  UserPlus, CheckCircle2, RotateCcw, UserCircle2, Sparkles,
} from 'lucide-react';
import { useStore, GroupType, MEMBER_COLORS, Friend } from '@/lib/store';
import { syncUser } from '@/app/actions/userActions';

const GROUP_TYPES: GroupType[] = ['Trip', 'Roommates', 'Event', 'Other'];
const TYPE_EMOJI: Record<GroupType, string> = { Trip: '✈️', Roommates: '🏠', Event: '🎉', Other: '💼' };

type Tab = 'friends' | 'groups';

function Avatar({ name, color, size = 8 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold"
      style={{ backgroundColor: color, width: size * 4, height: size * 4, fontSize: size < 8 ? 10 : 13 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ─── Add Friend Modal ─────────────────────────── */
function AddFriendModal({ onClose }: { onClose: () => void }) {
  const { addFriend } = useStore();
  const [name, setName] = useState('');
  const [balanceType, setBalanceType] = useState<'owe' | 'owed' | 'none'>('none');
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const raw = parseFloat(amount) || 0;
    const balance = balanceType === 'owed' ? raw : balanceType === 'owe' ? -raw : 0;
    addFriend(name.trim(), balance);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.07]">
          <h2 className="text-lg font-bold text-white">Add a Friend</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Friend's Name</label>
            <input
              autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul, Priya…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Settlement Status</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'none', label: 'All Settled', emoji: '✅' },
                { key: 'owed', label: 'They Owe Me', emoji: '💸' },
                { key: 'owe', label: 'I Owe Them', emoji: '🤝' },
              ] as const).map(opt => (
                <button
                  key={opt.key} type="button" onClick={() => setBalanceType(opt.key)}
                  className={`rounded-xl py-2.5 text-xs font-semibold transition-all border flex flex-col items-center gap-1 ${balanceType === opt.key ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  <span className="text-base">{opt.emoji}</span>{opt.label}
                </button>
              ))}
            </div>
          </div>

          {balanceType !== 'none' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Amount (₹)</label>
              <input
                type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>
          )}

          <button type="submit" className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            Add Friend →
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Create Group Modal (Backend synced) ──────── */
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

/* ─── Friend Card ──────────────────────────────── */
function FriendCard({ friend }: { friend: Friend }) {
  const { settleFriend, unsettleFriend } = useStore();
  const owes = friend.balance < 0;   // you owe them
  const owed = friend.balance > 0;   // they owe you

  return (
    <div className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${friend.settled ? 'border-white/[0.05] bg-white/[0.02] opacity-60' : 'border-white/[0.08] bg-white/[0.04] hover:border-indigo-500/30 hover:bg-white/[0.06]'}`}>
      <Avatar name={friend.name} color={friend.color} size={10} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm truncate">{friend.name}</div>
        {friend.settled ? (
          <div className="text-xs text-slate-500 mt-0.5">✅ All settled up</div>
        ) : friend.balance === 0 ? (
          <div className="text-xs text-slate-500 mt-0.5">No pending balance</div>
        ) : owes ? (
          <div className="text-xs text-rose-400 mt-0.5 font-medium">
            You owe ₹{Math.abs(friend.balance).toLocaleString('en-IN')}
          </div>
        ) : (
          <div className="text-xs text-emerald-400 mt-0.5 font-medium">
            Owes you ₹{friend.balance.toLocaleString('en-IN')}
          </div>
        )}
      </div>

      {!friend.settled && friend.balance !== 0 && (
        <div className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-bold ${owes ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
          {owes ? '-' : '+'}₹{Math.abs(friend.balance).toLocaleString('en-IN')}
        </div>
      )}

      {friend.settled ? (
        <button
          onClick={() => unsettleFriend(friend.id)}
          title="Mark as unsettled"
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          onClick={() => settleFriend(friend.id)}
          title="Mark as settled"
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ─── Friends Tab Content ──────────────────────── */
function FriendsTab({ onAddFriend }: { onAddFriend: () => void }) {
  const { friends } = useStore();
  const safeFriends = Array.isArray(friends) ? friends : [];
  const active = safeFriends.filter(f => !f.settled);
  const settled = safeFriends.filter(f => f.settled);

  const totalOwed = active.filter(f => f.balance > 0).reduce((s, f) => s + f.balance, 0);
  const totalOwe = active.filter(f => f.balance < 0).reduce((s, f) => s + Math.abs(f.balance), 0);

  if (safeFriends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
          <UserCircle2 className="h-10 w-10 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">No friends yet</h2>
        <p className="mt-2 max-w-sm text-slate-400">Add a friend to start tracking individual balances — who owes you, and who you owe.</p>
        <button
          onClick={onAddFriend}
          className="mt-8 flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all"
        >
          <UserPlus className="h-4 w-4" /> Add Friend
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Friends owe you</div>
          <div className="text-2xl font-extrabold text-emerald-400">₹{totalOwed.toLocaleString('en-IN')}</div>
          <div className="text-xs text-slate-600 mt-0.5">{active.filter(f => f.balance > 0).length} pending</div>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">You owe friends</div>
          <div className="text-2xl font-extrabold text-rose-400">₹{totalOwe.toLocaleString('en-IN')}</div>
          <div className="text-xs text-slate-600 mt-0.5">{active.filter(f => f.balance < 0).length} pending</div>
        </div>
      </div>

      {active.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Pending</h3>
            <span className="text-xs text-slate-600">{active.length} friend{active.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-3">
            {active.map(f => <FriendCard key={f.id} friend={f} />)}
          </div>
        </div>
      )}

      <button
        onClick={onAddFriend}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-500/30 bg-indigo-500/[0.04] py-4 text-sm font-semibold text-indigo-400 hover:bg-indigo-500/[0.08] hover:border-indigo-500/50 transition-all"
      >
        <UserPlus className="h-4 w-4" /> Add More Friends
      </button>

      {settled.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Previously Settled</h3>
            <span className="text-xs text-slate-600">{settled.length}</span>
          </div>
          <div className="space-y-2">
            {settled.map(f => <FriendCard key={f.id} friend={f} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Groups Tab Content ───────────────────────── */
function GroupsTab({ onCreateGroup }: { onCreateGroup: () => void }) {
  const { groups, expenses, loading } = useStore();
  const totalExpenses = expenses.length;
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-400 text-sm">Loading your groups from database...</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
          <Users className="h-10 w-10 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">No groups yet</h2>
        <p className="mt-2 max-w-sm text-slate-400">Create your first group to start splitting expenses and tracking who owes who.</p>
        <button
          onClick={onCreateGroup}
          className="mt-8 flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all"
        >
          <Plus className="h-4 w-4" /> Create Group
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          { label: 'Groups',   value: groups.length, icon: Users, color: 'text-indigo-400' },
          { label: 'Expenses', value: totalExpenses, icon: Receipt, color: 'text-emerald-400' },
          { label: 'Total',    value: `₹${totalAmount.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-violet-400' },
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
    </>
  );
}

/* ─── Dashboard Page Wrapper ───────────────────── */
export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>('friends');
  const [showCreate, setShowCreate] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);

  // Sync Clerk user with backend
  useEffect(() => { syncUser(); }, []);

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      {/* Background Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-700/15 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-700/10 blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07070f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-lg font-bold">
            <span className="text-indigo-400">Pay</span><span className="text-emerald-400">Matrix</span>
          </Link>
          <div className="flex items-center gap-2">
            {tab === 'friends' ? (
              <button onClick={() => setShowAddFriend(true)}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                <UserPlus className="h-4 w-4" /> Add Friend
              </button>
            ) : (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                <Plus className="h-4 w-4" /> New Group
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        {/* Header & Tabs Switcher */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">
              {tab === 'friends' ? 'Friends' : 'My Groups'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {tab === 'friends' ? 'Track individual balances with friends' : 'Manage your shared expenses and settle up (Cloud Synced)'}
            </p>
          </div>

          <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 gap-1">
            {(['friends', 'groups'] as const).map(t => (
              <button
                key={t} onClick={() => setTab(t)}
                className={`flex items-center justify-center flex-1 sm:flex-none gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}
              >
                {t === 'friends' ? <UserCircle2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Tab Content */}
        {tab === 'friends' ? (
          <FriendsTab onAddFriend={() => setShowAddFriend(true)} />
        ) : (
          <GroupsTab onCreateGroup={() => setShowCreate(true)} />
        )}
      </div>

      {showAddFriend && <AddFriendModal onClose={() => setShowAddFriend(false)} />}
      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
