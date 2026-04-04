'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type GroupType = 'Trip' | 'Roommates' | 'Event' | 'Other';
export type SplitType = 'equal' | 'unequal' | 'percentage';
export type Category = 'Food'|'Travel'|'Accommodation'|'Entertainment'|'Shopping'|'Utilities'|'Health'|'Other';

export interface Friend {
  id: string;
  name: string;
  email: string;
  color: string;
  avatar?: string;
  balance: number;   // positive = they owe you, negative = you owe them
  note?: string;
  settled: boolean;
  settledAt?: string;
  status: 'accepted' | 'pending';
  createdAt: string;
}

export interface Member { id: string; name: string; color: string; }
export interface ExpenseSplit { memberId: string; amount: number; }
export interface Expense {
  id: string; groupId: string; description: string; amount: number;
  paidBy: string; splitType: SplitType; splits: ExpenseSplit[];
  category: Category; createdAt: string;
}
export interface Group {
  id: string; name: string; type: GroupType;
  members: Member[]; inviteCode: string; createdAt: string;
}

export const MEMBER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316'];

// Normalize MongoDB _id → id
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ng = (g: any): Group => ({ id: g._id ?? g.id, name: g.name, type: g.type, members: g.members ?? [], inviteCode: g.inviteCode, createdAt: g.createdAt });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ne = (e: any): Expense => ({ id: e._id ?? e.id, groupId: e.groupId, description: e.description, amount: e.amount, paidBy: e.paidBy, splitType: e.splitType, splits: e.splits ?? [], category: e.category, createdAt: e.createdAt });

interface StoreCtx {
  groups: Group[]; expenses: Expense[]; friends: Friend[]; loading: boolean; friendsLoading: boolean;
  addGroup: (d: { name: string; type: GroupType; memberNames: string[] }) => Promise<Group>;
  addMember: (groupId: string, name: string) => Promise<void>;
  removeMember: (groupId: string, memberId: string) => Promise<void>;
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getGroup: (id: string) => Group | undefined;
  getGroupExpenses: (groupId: string) => Expense[];
  getNetBalances: (groupId: string) => Record<string, number>;
  refreshGroups: () => Promise<void>;
  refreshFriends: () => Promise<void>;
  // Friend functions (all MongoDB-backed now)
  addFriend: (name: string, balance: number) => void; // kept for backward compat
  inviteFriend: (email: string, balance: number, note?: string) => Promise<{ success: boolean; inviteUrl?: string; message?: string; error?: string }>;
  settleFriend: (id: string) => Promise<void>;
  unsettleFriend: (id: string) => Promise<void>;
  updateFriendBalance: (id: string, balance: number) => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups]     = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]   = useState(true);
  const [friends, setFriends]   = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  /* ── Groups ───────────────────────────────────────────────────────── */
  const refreshGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/groups');
      if (!res.ok) { setGroups([]); setExpenses([]); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let raw: any;
      try { raw = JSON.parse(await res.text()); } catch { setGroups([]); setExpenses([]); return; }
      const gs: Group[] = Array.isArray(raw) ? raw.map(ng) : [];
      setGroups(gs);
      const all = await Promise.all(
        gs.map(g => fetch(`/api/groups/${g.id}/expenses`).then(r => r.ok ? r.json() : []).then((a: unknown[]) => Array.isArray(a) ? a.map(ne) : []))
      );
      setExpenses(all.flat());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshGroups(); }, [refreshGroups]);

  /* ── Friends (MongoDB) ────────────────────────────────────────────── */
  const refreshFriends = useCallback(async () => {
    try {
      setFriendsLoading(true);
      const res = await fetch('/api/friends');
      if (!res.ok) { setFriends([]); return; }
      const raw = await res.json();
      setFriends(Array.isArray(raw) ? raw : []);
    } catch (err) { console.error('refreshFriends:', err); }
    finally { setFriendsLoading(false); }
  }, []);

  useEffect(() => { refreshFriends(); }, [refreshFriends]);

  /* ── Group mutations ──────────────────────────────────────────────── */
  const addGroup = useCallback(async (d: { name: string; type: GroupType; memberNames: string[] }): Promise<Group> => {
    const res = await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    const g = ng(await res.json());
    setGroups(p => [g, ...p]);
    return g;
  }, []);

  const addMember = useCallback(async (groupId: string, name: string) => {
    const group = groups.find(g => g.id === groupId); if (!group) return;
    const newMember: Member = { id: Date.now().toString(36), name, color: MEMBER_COLORS[group.members.length % MEMBER_COLORS.length] };
    const res = await fetch(`/api/groups/${groupId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ members: [...group.members, newMember] }) });
    setGroups(p => p.map(g => g.id === groupId ? ng(res.ok ? res.json() : g) : g));
    await refreshGroups();
  }, [groups, refreshGroups]);

  const removeMember = useCallback(async (groupId: string, memberId: string) => {
    const group = groups.find(g => g.id === groupId); if (!group) return;
    await fetch(`/api/groups/${groupId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ members: group.members.filter(m => m.id !== memberId) }) });
    await refreshGroups();
  }, [groups, refreshGroups]);

  const addExpense = useCallback(async (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    const res = await fetch(`/api/groups/${expense.groupId}/expenses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expense) });
    const raw = await res.json();
    setExpenses(p => [ne(raw), ...p]);
  }, []);

  const deleteExpense = useCallback(async (expenseId: string) => {
    await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
    setExpenses(p => p.filter(e => e.id !== expenseId));
  }, []);

  const getGroup = useCallback((id: string) => groups.find(g => g.id === id), [groups]);
  const getGroupExpenses = useCallback((gid: string) => expenses.filter(e => e.groupId === gid), [expenses]);
  const getNetBalances = useCallback((groupId: string): Record<string, number> => {
    const group = groups.find(g => g.id === groupId); if (!group) return {};
    const bal: Record<string, number> = {};
    group.members.forEach(m => (bal[m.id] = 0));
    expenses.filter(e => e.groupId === groupId).forEach(exp => {
      bal[exp.paidBy] = (bal[exp.paidBy] || 0) + exp.amount;
      exp.splits.forEach(s => { bal[s.memberId] = (bal[s.memberId] || 0) - s.amount; });
    });
    return bal;
  }, [groups, expenses]);

  /* ── Friend mutations ─────────────────────────────────────────────── */
  const inviteFriend = useCallback(async (email: string, balance: number, note?: string) => {
    const res = await fetch('/api/friends/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverEmail: email, balance, note }),
    });
    const data = await res.json();
    if (data.success) {
      await refreshFriends();
      return { success: true, inviteUrl: data.inviteUrl, message: data.message };
    }
    return { success: false, error: data.error };
  }, [refreshFriends]);

  // Stub kept for type compatibility (not used — use inviteFriend instead)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const addFriend = useCallback((_name: string, _balance: number) => {}, []);

  const settleFriend = useCallback(async (id: string) => {
    await fetch(`/api/friends/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settled: true }),
    });
    setFriends(p => p.map(f => f.id === id ? { ...f, settled: true, balance: 0, settledAt: new Date().toISOString() } : f));
  }, []);

  const unsettleFriend = useCallback(async (id: string) => {
    await fetch(`/api/friends/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settled: false }),
    });
    setFriends(p => p.map(f => f.id === id ? { ...f, settled: false, settledAt: undefined } : f));
  }, []);

  const updateFriendBalance = useCallback(async (id: string, balance: number) => {
    await fetch(`/api/friends/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance }),
    });
    setFriends(p => p.map(f => f.id === id ? { ...f, balance, settled: false } : f));
  }, []);

  return (
    <Ctx.Provider value={{
      groups, expenses, friends, loading, friendsLoading,
      addGroup, addMember, removeMember, addExpense, deleteExpense,
      getGroup, getGroupExpenses, getNetBalances, refreshGroups, refreshFriends,
      addFriend, inviteFriend, settleFriend, unsettleFriend, updateFriendBalance,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore must be inside StoreProvider');
  return c;
}
