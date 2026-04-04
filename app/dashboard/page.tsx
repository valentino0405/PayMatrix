'use client';
import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Users, X, ArrowRight, Receipt, TrendingUp, Loader2,
  UserPlus, CheckCircle2, RotateCcw, UserCircle2, Mail, Clock, Copy, Check, Share2,
} from 'lucide-react';
import { useStore, GroupType, MEMBER_COLORS, Friend } from '@/lib/store';
import { syncUser } from '@/app/actions/userActions';

const GROUP_TYPES: GroupType[] = ['Trip', 'Roommates', 'Event', 'Other'];
const TYPE_EMOJI: Record<GroupType, string> = { Trip: '✈️', Roommates: '🏠', Event: '🎉', Other: '💼' };

type Tab = 'friends' | 'groups';

function Avatar({ name, color, size = 8, avatar }: { name?: string; color?: string; size?: number; avatar?: string }) {
  if (avatar) {
    return <img src={avatar} alt={name || '?'} className="rounded-full object-cover" style={{ width: size * 4, height: size * 4 }} />;
  }
  const safeName = name || '?';
  const safeColor = color || '#6366f1';
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
      style={{ backgroundColor: safeColor, width: size * 4, height: size * 4, fontSize: size < 8 ? 10 : 13 }}
    >
      {safeName.charAt(0).toUpperCase()}
    </div>
  );
}

/* ─── Add Friend Modal ─── (shareable invite link) ── */
function AddFriendModal({ onClose }: { onClose: () => void }) {
  const { inviteFriend } = useStore();
  const [email, setEmail]             = useState('');
  const [balanceType, setBalanceType] = useState<'owe' | 'owed' | 'none'>('none');
  const [amount, setAmount]           = useState('');
  const [note, setNote]               = useState('');
  const [busy, setBusy]               = useState(false);
  const [inviteUrl, setInviteUrl]     = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const raw = parseFloat(amount) || 0;
    const balance = balanceType === 'owed' ? raw : balanceType === 'owe' ? -raw : 0;
    setBusy(true);
    setError(null);
    const res = await inviteFriend(email.trim().toLowerCase(), balance, note.trim());
    setBusy(false);
    if (res.success && res.inviteUrl) {
      setInviteUrl(res.inviteUrl);
    } else {
      setError(res.error ?? 'Something went wrong. Please try again.');
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!inviteUrl) return;
    const msg = encodeURIComponent(`Hey! I've added you on PayMatrix to track our expenses. Click this link to accept: ${inviteUrl}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  // Success: show shareable link
  if (inviteUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="p-6">
            <div className="text-center mb-5">
              <div className="mb-3 mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Share2 className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Share this invite link!</h2>
              <p className="mt-1 text-xs text-slate-400">
                Send this link to <span className="text-indigo-300 font-medium">{email}</span> via WhatsApp, iMessage, or any app
              </p>
            </div>

            {/* Invite link box */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 mb-4">
              <p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">Invite Link</p>
              <p className="text-xs text-indigo-300 break-all font-mono">{inviteUrl}</p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={handleCopy}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all border ${copied ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300' : 'border-white/10 bg-white/5 text-white hover:bg-white/10'}`}
              >
                {copied ? <><Check className="h-4 w-4" />Copied!</> : <><Copy className="h-4 w-4" />Copy Link</>}
              </button>
              <button
                onClick={handleWhatsApp}
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all"
              >
                <span className="text-base">💬</span> WhatsApp
              </button>
            </div>

            <button onClick={onClose} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10 transition-all">
              Done
            </button>

            <p className="text-center text-xs text-slate-600 mt-3">
              Link expires in 7 days · They'll appear in Friends once they accept
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] shadow-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.07]">
          <div>
            <h2 className="text-lg font-bold text-white">Add a Friend</h2>
            <p className="text-xs text-slate-500 mt-0.5">Enter their email to generate a shareable invite link</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Friend's Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="friend@example.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>
          </div>

          {/* Balance direction */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current Balance</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'none', label: 'All Settled', emoji: '✅' },
                { key: 'owed', label: 'They Owe Me', emoji: '💸' },
                { key: 'owe',  label: 'I Owe Them',  emoji: '🤝' },
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

          {/* Amount */}
          {balanceType !== 'none' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Amount (₹)</label>
              <input
                type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Note <span className="text-slate-600 normal-case font-normal">(optional)</span></label>
            <input
              type="text" value={note} onChange={e => setNote(e.target.value)} placeholder='e.g. "Dinner at Barbeque Nation"'
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={busy || !email.trim()}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Creating link...</> : <><Share2 className="h-4 w-4" />Generate Invite Link →</>}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Create Group Modal ───────────────────────── */
function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const { addGroup } = useStore();
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<GroupType>('Trip');
  const [members, setMembers] = useState([{ name: '', email: '' }, { name: '', email: '' }]);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const valid = members.filter(m => m.name.trim());
    if (valid.length < 2) return alert('Add at least 2 members');
    setBusy(true);
    try {
      const group = await addGroup({ name: name.trim(), type, members: valid });
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
            <div className="space-y-3">
              {members.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex h-10 w-10 shrink-0 mt-1 items-center justify-center rounded-full text-white text-xs font-bold" style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>
                    {m.name ? m.name[0].toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input value={m.name} onChange={e => setMembers(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder={`Member ${i + 1} Name`}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 transition-all" />
                    <input value={m.email} onChange={e => setMembers(p => p.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} placeholder={`Email (for global identity)`} type="email"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 transition-all" />
                  </div>
                  {members.length > 2 && (
                    <button type="button" onClick={() => setMembers(p => p.filter((_, j) => j !== i))}
                      className="flex h-10 w-10 shrink-0 mt-1 items-center justify-center rounded-full text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setMembers(p => [...p, { name: '', email: '' }])} className="mt-4 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
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
  const [loading, setLoading] = useState(false);
  const isPending = friend.status === 'pending';
  const owes = friend.balance < 0;

  const handleSettle = async () => {
    setLoading(true);
    await settleFriend(friend.id);
    setLoading(false);
  };
  const handleUnsettle = async () => {
    setLoading(true);
    await unsettleFriend(friend.id);
    setLoading(false);
  };

  return (
    <div className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
      isPending ? 'border-amber-500/20 bg-amber-500/[0.04] opacity-70' :
      friend.settled ? 'border-white/[0.05] bg-white/[0.02] opacity-60' :
      'border-white/[0.08] bg-white/[0.04] hover:border-indigo-500/30 hover:bg-white/[0.06]'
    }`}>
      <Avatar name={friend.name} color={friend.color} size={10} avatar={friend.avatar} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm truncate">{friend.name}</div>
        {isPending ? (
          <div className="flex items-center gap-1 text-xs text-amber-400 mt-0.5">
            <Clock className="h-3 w-3" /> Invite pending · awaiting acceptance
          </div>
        ) : friend.settled ? (
          <div className="text-xs text-slate-500 mt-0.5">✅ All settled up</div>
        ) : friend.balance === 0 ? (
          <div className="text-xs text-slate-500 mt-0.5">No pending balance</div>
        ) : owes ? (
          <div className="text-xs text-rose-400 mt-0.5 font-medium">
            You owe ₹{Math.abs(friend.balance).toLocaleString('en-IN')}
            {friend.note && <span className="text-slate-600"> · {friend.note}</span>}
          </div>
        ) : (
          <div className="text-xs text-emerald-400 mt-0.5 font-medium">
            Owes you ₹{friend.balance.toLocaleString('en-IN')}
            {friend.note && <span className="text-slate-600"> · {friend.note}</span>}
          </div>
        )}
      </div>

      {!isPending && !friend.settled && friend.balance !== 0 && (
        <div className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-bold ${owes ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
          {owes ? '-' : '+'}₹{Math.abs(friend.balance).toLocaleString('en-IN')}
        </div>
      )}

      {!isPending && (
        friend.settled ? (
          <button onClick={handleUnsettle} disabled={loading} title="Mark unsettled"
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <button onClick={handleSettle} disabled={loading} title="Mark as settled"
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          </button>
        )
      )}
    </div>
  );
}

/* ─── Friends Tab ──────────────────────────────── */
function FriendsTab({ onAddFriend }: { onAddFriend: () => void }) {
  const { friends, friendsLoading } = useStore();
  const safeFriends = Array.isArray(friends) ? friends : [];
  const active  = safeFriends.filter(f => !f.settled && f.status === 'accepted');
  const pending = safeFriends.filter(f => f.status === 'pending');
  const settled = safeFriends.filter(f => f.settled && f.status === 'accepted');

  const totalOwed = active.filter(f => f.balance > 0).reduce((s, f) => s + f.balance, 0);
  const totalOwe  = active.filter(f => f.balance < 0).reduce((s, f) => s + Math.abs(f.balance), 0);

  if (friendsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-400 text-sm">Loading your friends...</p>
      </div>
    );
  }

  if (safeFriends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
          <UserCircle2 className="h-10 w-10 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">No friends yet</h2>
        <p className="mt-2 max-w-sm text-slate-400">Send an invite to a friend's email — they'll get a link to join and you can start tracking balances together.</p>
        <button
          onClick={onAddFriend}
          className="mt-8 flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all"
        >
          <UserPlus className="h-4 w-4" /> Invite a Friend
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Friends owe you</div>
          <div className="text-2xl font-extrabold text-emerald-400">₹{totalOwed.toLocaleString('en-IN')}</div>
          <div className="text-xs text-slate-600 mt-0.5">{active.filter(f => f.balance > 0).length} friend{active.filter(f => f.balance > 0).length !== 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">You owe friends</div>
          <div className="text-2xl font-extrabold text-rose-400">₹{totalOwe.toLocaleString('en-IN')}</div>
          <div className="text-xs text-slate-600 mt-0.5">{active.filter(f => f.balance < 0).length} friend{active.filter(f => f.balance < 0).length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Active */}
      {active.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Active</h3>
            <span className="text-xs text-slate-600">{active.length}</span>
          </div>
          <div className="space-y-3">{active.map(f => <FriendCard key={f.id} friend={f} />)}</div>
        </div>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-amber-500/70 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Pending Invites
            </h3>
            <span className="text-xs text-slate-600">{pending.length}</span>
          </div>
          <div className="space-y-3">{pending.map(f => <FriendCard key={f.id} friend={f} />)}</div>
        </div>
      )}

      {/* Add more */}
      <button onClick={onAddFriend}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-500/30 bg-indigo-500/[0.04] py-4 text-sm font-semibold text-indigo-400 hover:bg-indigo-500/[0.08] hover:border-indigo-500/50 transition-all">
        <UserPlus className="h-4 w-4" /> Invite More Friends
      </button>

      {/* Settled */}
      {settled.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Settled</h3>
            <span className="text-xs text-slate-600">{settled.length}</span>
          </div>
          <div className="space-y-2">{settled.map(f => <FriendCard key={f.id} friend={f} />)}</div>
        </div>
      )}
    </div>
  );
}

/* ─── Groups Tab ───────────────────────────────── */
function GroupsTab({ onCreateGroup }: { onCreateGroup: () => void }) {
  const { groups, expenses, loading } = useStore();
  const totalExpenses = expenses.length;
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
      <p className="text-slate-400 text-sm">Loading your groups from database...</p>
    </div>
  );

  if (groups.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
        <Users className="h-10 w-10 text-indigo-400" />
      </div>
      <h2 className="text-2xl font-bold text-white">No groups yet</h2>
      <p className="mt-2 max-w-sm text-slate-400">Create a group to start splitting expenses with multiple people.</p>
      <button onClick={onCreateGroup} className="mt-8 flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all">
        <Plus className="h-4 w-4" /> Create Group
      </button>
    </div>
  );

  return (
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
          const gExpenses = expenses.filter(e => e.groupId === group.id);
          const total = gExpenses.reduce((s, e) => s + e.amount, 0);
          return (
            <Link key={group.id} href={`/groups/${group.id}`} className="group block">
              <div className="h-full rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 transition-all hover:border-indigo-500/40 hover:bg-white/[0.06] hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(99,102,241,0.15)]">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-xl">{TYPE_EMOJI[group.type]}</span>
                    <h3 className="mt-1 text-base font-bold text-white group-hover:text-indigo-300 transition-colors">{group.name}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-block rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">{group.type}</span>
                      {group.createdViaScan && (
                        <span className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">Scanned</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>
                <div className="flex items-center gap-1.5 mb-4">
                  {group.members.slice(0, 5).map(m => (
                    <Avatar key={m.id} name={m.name} color={m.color} size={7} />
                  ))}
                  {group.members.length > 5 && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs text-slate-400">+{group.members.length - 5}</div>
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

/* ─── Dashboard Page ───────────────────────────── */
export default function DashboardPage() {
  const [tab, setTab]                 = useState<Tab>('groups');
  const [showCreate, setShowCreate]   = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);

  useEffect(() => { syncUser().catch(console.error); }, []);

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-700/15 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-700/10 blur-[120px]" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07070f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-lg font-bold">
            <span className="text-indigo-400">Pay</span><span className="text-emerald-400">Matrix</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/global-settle" className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all">
              🌍 Global Optimization
            </Link>
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
                    userButtonOuterIdentifier: "text-sm font-semibold !text-white",
                    userButtonTrigger: "h-9 rounded-xl border border-white/10 bg-white/5 px-2 text-white hover:bg-white/10 transition-all shadow-none focus:shadow-none focus:ring-0",
                    userButtonAvatarBox: "h-7 w-7 rounded-full border border-white/10",
                    userButtonPopoverCard: "rounded-2xl border border-white/[0.07] bg-[#111118] !text-white shadow-2xl",
                    userButtonPopoverActions: "gap-1 p-2",
                    userButtonPopoverActionButton: "rounded-xl border border-transparent bg-transparent !text-white hover:bg-white/10 hover:border-white/10 active:bg-white/10",
                    userButtonPopoverActionButtonText: "text-sm font-semibold !text-white",
                    userButtonPopoverActionButtonIcon: "!text-slate-400",
                    userPreviewMainIdentifier: "text-sm font-semibold !text-white",
                    userPreviewSecondaryIdentifier: "text-xs !text-slate-400",
                    userButtonPopoverMain: "!text-white",
                    userButtonPopoverActionButton__manageAccount: "rounded-xl border border-transparent bg-transparent !text-white hover:bg-white/10 hover:border-white/10 active:bg-white/10",
                    userButtonPopoverActionButton__signOut: "rounded-xl border border-transparent bg-transparent !text-white hover:bg-white/10 hover:border-white/10 active:bg-white/10",
                    userButtonPopoverFooter: "hidden",
                  },
                }}
              />
          </div>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">
              {tab === 'friends' ? 'Friends' : 'My Groups'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {tab === 'friends' ? 'Track individual balances & send invites via email' : 'Manage shared expenses — synced to MongoDB'}
            </p>
          </div>

          <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 gap-1">
            {(['friends', 'groups'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center justify-center flex-1 sm:flex-none gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}>
                {t === 'friends' ? <UserCircle2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {tab === 'friends'
          ? <FriendsTab onAddFriend={() => setShowAddFriend(true)} />
          : <GroupsTab onCreateGroup={() => setShowCreate(true)} />
        }
      </div>

      {showAddFriend && <AddFriendModal onClose={() => setShowAddFriend(false)} />}
      {showCreate    && <CreateGroupModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
