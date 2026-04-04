'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type GroupType = 'Trip' | 'Roommates' | 'Event' | 'Other';
export type SplitType = 'equal' | 'unequal' | 'percentage';
export type Category = 'Food'|'Travel'|'Accommodation'|'Entertainment'|'Shopping'|'Utilities'|'Health'|'Other';

export interface Friend {
  id: string;
  name: string;
  color: string;
  balance: number; // positive = they owe you, negative = you owe them
  settled: boolean;
  settledAt?: string;
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
  groups: Group[]; expenses: Expense[]; friends: Friend[]; loading: boolean;
  addGroup: (d: { name: string; type: GroupType; memberNames: string[] }) => Promise<Group>;
  addMember: (groupId: string, name: string) => Promise<void>;
  removeMember: (groupId: string, memberId: string) => Promise<void>;
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getGroup: (id: string) => Group | undefined;
  getGroupExpenses: (groupId: string) => Expense[];
  getNetBalances: (groupId: string) => Record<string, number>;
  refreshGroups: () => Promise<void>;
  
  // Friend functions
  addFriend: (name: string, balance: number) => void;
  settleFriend: (id: string) => void;
  unsettleFriend: (id: string) => void;
  updateFriendBalance: (id: string, balance: number) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
const FRIENDS_STORAGE_KEY = 'paymatrix_friends_v1';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsReady, setFriendsReady] = useState(false);

  // Load friends from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FRIENDS_STORAGE_KEY);
      if (raw) setFriends(JSON.parse(raw) || []);
    } catch {}
    setFriendsReady(true);
  }, []);

  // Save friends to localStorage
  useEffect(() => {
    if (friendsReady) localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friends));
  }, [friends, friendsReady]);

  // Handle older storage key fallback to prevent crash from undefined filter
  useEffect(() => {
    try {
      const rawOld = localStorage.getItem('paymatrix_v1');
      if (rawOld && friends.length === 0) {
        const parsed = JSON.parse(rawOld);
        if (parsed && Array.isArray(parsed.friends) && parsed.friends.length > 0) {
          setFriends(parsed.friends);
          // Delete old key to migrate fully over
          localStorage.removeItem('paymatrix_v1');
        }
      }
    } catch {}
  }, [friends.length]);


  const refreshGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/groups');
      if (!res.ok) { setGroups([]); setExpenses([]); return; }
      const raw = await res.json();
      const gs: Group[] = Array.isArray(raw) ? raw.map(ng) : [];
      setGroups(gs);
      // Load expenses for all groups in parallel
      const all = await Promise.all(
        gs.map(g => fetch(`/api/groups/${g.id}/expenses`).then(r => r.ok ? r.json() : []).then((a: unknown[]) => Array.isArray(a) ? a.map(ne) : []))
      );
      setExpenses(all.flat());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshGroups(); }, [refreshGroups]);

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

  // Friend logic
  const addFriend = useCallback((name: string, balance: number) => {
    const f: Friend = {
      id: uid(), name, balance, settled: false,
      color: MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)],
      createdAt: new Date().toISOString(),
    };
    setFriends(p => (Array.isArray(p) ? [...p, f] : [f]));
  }, []);

  const settleFriend = useCallback((id: string) => {
    setFriends(p => p.map(f => f.id === id ? { ...f, settled: true, balance: 0, settledAt: new Date().toISOString() } : f));
  }, []);

  const unsettleFriend = useCallback((id: string) => {
    setFriends(p => p.map(f => f.id === id ? { ...f, settled: false, settledAt: undefined } : f));
  }, []);

  const updateFriendBalance = useCallback((id: string, balance: number) => {
    setFriends(p => p.map(f => f.id === id ? { ...f, balance, settled: false } : f));
  }, []);

  return (
    <Ctx.Provider value={{
      groups, expenses, friends, loading,
      addGroup, addMember, removeMember, addExpense, deleteExpense,
      getGroup, getGroupExpenses, getNetBalances, refreshGroups,
      addFriend, settleFriend, unsettleFriend, updateFriendBalance
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
