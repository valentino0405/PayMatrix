'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type GroupType = 'Trip' | 'Roommates' | 'Event' | 'Other';
export type SplitType = 'equal' | 'unequal' | 'percentage';
export type Category = 'Food'|'Travel'|'Accommodation'|'Entertainment'|'Shopping'|'Utilities'|'Health'|'Other';

export interface Member { id: string; name: string; color: string; email?: string; }
export interface ExpenseSplit { memberId: string; amount: number; }
export interface Expense {
  id: string; groupId: string; description: string; amount: number;
  paidBy: string; splitType: SplitType; splits: ExpenseSplit[];
  category: Category; isSuspicious?: boolean; createdAt: string;
}
export interface Group {
  id: string; name: string; type: GroupType;
  members: Member[]; inviteCode: string; monthlyBudget?: number; createdAt: string;
}

export const MEMBER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316'];

// Normalize MongoDB _id → id
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ng = (g: any): Group => ({
  id: String(g._id ?? g.id),
  name: g.name,
  type: g.type,
  members: (g.members ?? []).map((m: Member) => ({ ...m })),
  inviteCode: g.inviteCode,
  monthlyBudget: g.monthlyBudget,
  createdAt: g.createdAt,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ne = (e: any): Expense => ({
  id: String(e._id ?? e.id),
  groupId: String(e.groupId),
  description: e.description,
  amount: Number(e.amount),
  paidBy: String(e.paidBy),
  splitType: e.splitType,
  splits: (e.splits ?? []).map((s: ExpenseSplit) => ({ memberId: String(s.memberId), amount: Number(s.amount) })),
  category: e.category ?? 'Other',
  isSuspicious: e.isSuspicious ?? false,
  createdAt: e.createdAt,
});

interface StoreCtx {
  groups: Group[]; expenses: Expense[]; loading: boolean;
  addGroup: (d: { name: string; type: GroupType; members: { name: string; email?: string }[] }) => Promise<Group>;
  updateGroupBudget: (groupId: string, budget: number | undefined) => Promise<void>;
  addMember: (groupId: string, name: string) => Promise<void>;
  removeMember: (groupId: string, memberId: string) => Promise<void>;
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getGroup: (id: string) => Group | undefined;
  getGroupExpenses: (groupId: string) => Expense[];
  getNetBalances: (groupId: string) => Record<string, number>;
  refreshGroups: () => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Core fetch: load all groups + all their expenses ────────────────────────
  const refreshGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/groups');
      if (!res.ok) { setGroups([]); setExpenses([]); return; }

      const rawGroups = await res.json();
      const gs: Group[] = rawGroups.map(ng);
      setGroups(gs);

      if (gs.length === 0) { setExpenses([]); return; }

      // Fetch expenses for all groups in parallel
      const expArrays = await Promise.all(
        gs.map(async (g) => {
          try {
            const r = await fetch(`/api/groups/${g.id}/expenses`);
            if (!r.ok) return [];
            const raw = await r.json();
            return Array.isArray(raw) ? raw.map(ne) : [];
          } catch { return []; }
        })
      );
      setExpenses(expArrays.flat());
    } catch (err) {
      console.error('refreshGroups error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshGroups(); }, [refreshGroups]);

  // ── addGroup ─────────────────────────────────────────────────────────────────
  const addGroup = useCallback(async (d: { name: string; type: GroupType; members: { name: string; email?: string }[] }): Promise<Group> => {
    const res = await fetch('/api/groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
    });
    if (!res.ok) throw new Error('Failed to create group');
    const raw = await res.json();
    const g = ng(raw);
    setGroups(p => [g, ...p]);
    return g;
  }, []);

  // ── addMember ────────────────────────────────────────────────────────────────
  const addMember = useCallback(async (groupId: string, name: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const newMember: Member = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name,
      color: MEMBER_COLORS[group.members.length % MEMBER_COLORS.length],
    };
    const res = await fetch(`/api/groups/${groupId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: [...group.members, newMember] }),
    });
    if (res.ok) {
      const raw = await res.json();
      setGroups(p => p.map(g => g.id === groupId ? ng(raw) : g));
    }
  }, [groups]);

  // ── removeMember ─────────────────────────────────────────────────────────────
  const removeMember = useCallback(async (groupId: string, memberId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const res = await fetch(`/api/groups/${groupId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: group.members.filter(m => m.id !== memberId) }),
    });
    if (res.ok) {
      const raw = await res.json();
      setGroups(p => p.map(g => g.id === groupId ? ng(raw) : g));
    }
  }, [groups]);

  // ── updateGroupBudget ────────────────────────────────────────────────────────
  const updateGroupBudget = useCallback(async (groupId: string, budget: number | undefined) => {
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyBudget: budget === undefined ? null : budget }),
      });
      if (!res.ok) throw new Error();
      setGroups(p => p.map(g => g.id === groupId ? { ...g, monthlyBudget: budget } : g));
    } catch { throw new Error('Failed to update group budget'); }
  }, []);

  // ── addExpense — write to DB, then RE-FETCH to get the real stored data ──────
  const addExpense = useCallback(async (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    const res = await fetch(`/api/groups/${expense.groupId}/expenses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expense),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to save expense: ${err}`);
    }
    const raw = await res.json();
    const saved = ne(raw);
    // Immediately add to local state for instant UI update
    setExpenses(p => [saved, ...p.filter(e => e.id !== saved.id)]);
  }, []);

  // ── deleteExpense ─────────────────────────────────────────────────────────────
  const deleteExpense = useCallback(async (expenseId: string) => {
    await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
    setExpenses(p => p.filter(e => e.id !== expenseId));
  }, []);

  // ── Selectors ─────────────────────────────────────────────────────────────────
  const getGroup = useCallback((id: string) => groups.find(g => g.id === id), [groups]);

  const getGroupExpenses = useCallback((gid: string) => {
    return expenses.filter(e => e.groupId === gid);
  }, [expenses]);

  const getNetBalances = useCallback((groupId: string): Record<string, number> => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return {};
    const bal: Record<string, number> = {};
    group.members.forEach(m => { bal[m.id] = 0; });
    expenses
      .filter(e => e.groupId === groupId)
      .forEach(exp => {
        bal[exp.paidBy] = (bal[exp.paidBy] || 0) + exp.amount;
        exp.splits.forEach(s => { bal[s.memberId] = (bal[s.memberId] || 0) - s.amount; });
      });
    return bal;
  }, [groups, expenses]);

  return (
    <Ctx.Provider value={{
      groups, expenses, loading,
      addGroup, addMember, removeMember, updateGroupBudget, addExpense, deleteExpense,
      getGroup, getGroupExpenses, getNetBalances, refreshGroups,
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
