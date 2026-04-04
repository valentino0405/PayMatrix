'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type GroupType = 'Trip' | 'Roommates' | 'Event' | 'Other';
export type SplitType = 'equal' | 'unequal' | 'percentage';
export type Category = 'Food'|'Travel'|'Accommodation'|'Entertainment'|'Shopping'|'Utilities'|'Health'|'Other';

export interface Member { id: string; name: string; color: string; }
export interface ExpenseSplit { memberId: string; amount: number; }
export interface Expense {
  id: string; groupId: string; description: string; amount: number;
  paidBy: string; splitType: SplitType; splits: ExpenseSplit[];
  category: Category; createdAt: string;
}
export interface Settlement {
  from: string; to: string; amount: number; groupId: string; paymentTransactionId?: string;
}
export interface PaymentTxn {
  from: string; to: string; amount: number; groupId: string; status: string;
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
  groups: Group[]; expenses: Expense[]; loading: boolean;
  addGroup: (d: { name: string; type: GroupType; memberNames: string[] }) => Promise<Group>;
  addMember: (groupId: string, name: string) => Promise<void>;
  removeMember: (groupId: string, memberId: string) => Promise<void>;
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getGroup: (id: string) => Group | undefined;
  getGroupExpenses: (groupId: string) => Expense[];
  getGroupSettlements: (groupId: string) => Settlement[];
  getGroupPayments: (groupId: string) => PaymentTxn[];
  getNetBalances: (groupId: string, applySettlements?: boolean) => Record<string, number>;
  refreshGroups: () => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [payments, setPayments] = useState<PaymentTxn[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/groups');
      if (!res.ok) { setGroups([]); setExpenses([]); return; }
      const raw = await res.json();
      const gs: Group[] = raw.map(ng);
      setGroups(gs);
      // Load expenses for all groups in parallel
      const all = await Promise.all(
        gs.map(g => fetch(`/api/groups/${g.id}/expenses`).then(r => r.ok ? r.json() : []).then((a: unknown[]) => a.map(ne)))
      );
      setExpenses(all.flat());

      // Load settlements for all groups in parallel
      const allSettlements = await Promise.all(
        gs.map(g => fetch(`/api/groups/${g.id}/settlements`).then(r => r.ok ? r.json() : []).then(arr => arr.map((s: any) => ({ ...s, groupId: g.id }))))
      );
      setSettlements(allSettlements.flat());

      // Load successful payments for all groups
      const allPayments = await Promise.all(
        gs.map(g => fetch(`/api/groups/${g.id}/payments?status=success`).then(r => r.ok ? r.json() : []).then(arr => arr.map((p: any) => ({ ...p, groupId: g.id }))))
      );
      setPayments(allPayments.flat());
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
  const getGroupSettlements = useCallback((gid: string) => settlements.filter(s => s.groupId === gid), [settlements]);
  const getGroupPayments = useCallback((gid: string) => payments.filter(p => p.groupId === gid), [payments]);
  
  const getNetBalances = useCallback((groupId: string, applySettlements: boolean = false): Record<string, number> => {
    const group = groups.find(g => g.id === groupId); if (!group) return {};
    const bal: Record<string, number> = {};
    group.members.forEach(m => (bal[m.id] = 0));
    
    // 1. Calculate debt based purely on expenses
    expenses.filter(e => e.groupId === groupId).forEach(exp => {
      bal[exp.paidBy] = (bal[exp.paidBy] || 0) + exp.amount;
      exp.splits.forEach(s => { bal[s.memberId] = (bal[s.memberId] || 0) - s.amount; });
    });
    
    // 2. Adjust debt using completed actual payments + manual settlements
    if (applySettlements) {
      // 2a. Real payments (Razorpay/UPI) that succeeded
      payments.filter(p => p.groupId === groupId && p.status === 'success').forEach(txn => {
        bal[txn.from] = (bal[txn.from] || 0) + txn.amount;
        bal[txn.to] = (bal[txn.to] || 0) - txn.amount;
      });

      // 2b. Manual mark paid (Settlements with NO underlying payment transaction to avoid double counts)
      settlements.filter(s => s.groupId === groupId && !s.paymentTransactionId).forEach(settlement => {
        bal[settlement.from] = (bal[settlement.from] || 0) + settlement.amount;
        bal[settlement.to] = (bal[settlement.to] || 0) - settlement.amount;
      });
    }

    // Fix floating point math rounding errors
    for (const key of Object.keys(bal)) {
      bal[key] = Math.round(bal[key] * 100) / 100;
    }

    return bal;
  }, [groups, expenses, settlements, payments]);

  return (
    <Ctx.Provider value={{ groups, expenses, loading, addGroup, addMember, removeMember, addExpense, deleteExpense, getGroup, getGroupExpenses, getGroupSettlements, getGroupPayments, getNetBalances, refreshGroups }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore must be inside StoreProvider');
  return c;
}
