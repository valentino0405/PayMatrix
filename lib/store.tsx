'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type GroupType = 'Trip' | 'Roommates' | 'Event' | 'Other';
export type SplitType = 'equal' | 'unequal' | 'percentage';
export type Category = 'Food' | 'Travel' | 'Accommodation' | 'Entertainment' | 'Shopping' | 'Utilities' | 'Health' | 'Other';

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

interface StoreState { groups: Group[]; expenses: Expense[]; }
interface StoreCtx extends StoreState {
  addGroup: (d: { name: string; type: GroupType; memberNames: string[] }) => Group;
  addMember: (groupId: string, name: string) => void;
  removeMember: (groupId: string, memberId: string) => void;
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => void;
  deleteExpense: (id: string) => void;
  getGroup: (id: string) => Group | undefined;
  getGroupExpenses: (groupId: string) => Expense[];
  getNetBalances: (groupId: string) => Record<string, number>;
  loadDemo: () => void;
}

export const MEMBER_COLORS = [
  '#6366f1','#ec4899','#f59e0b','#10b981',
  '#3b82f6','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316',
];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function icode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

function makeDemoData(): StoreState {
  const alice: Member = { id: uid(), name: 'Alice', color: MEMBER_COLORS[0] };
  const bob: Member   = { id: uid(), name: 'Bob',   color: MEMBER_COLORS[1] };
  const charlie: Member = { id: uid(), name: 'Charlie', color: MEMBER_COLORS[2] };
  const diana: Member   = { id: uid(), name: 'Diana',   color: MEMBER_COLORS[3] };
  const members = [alice, bob, charlie, diana];

  const group: Group = {
    id: uid(), name: 'Goa Trip 🌊', type: 'Trip',
    members, inviteCode: icode(),
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  };

  const eq = (ms: Member[], total: number) => ms.map(m => ({ memberId: m.id, amount: +(total / ms.length).toFixed(2) }));

  const expenses: Expense[] = [
    { id: uid(), groupId: group.id, description: 'Hotel booking', amount: 8000, paidBy: alice.id, splitType: 'equal', splits: eq(members, 8000), category: 'Accommodation', createdAt: new Date(Date.now() - 6 * 86400000).toISOString() },
    { id: uid(), groupId: group.id, description: 'Flight tickets', amount: 12000, paidBy: bob.id, splitType: 'equal', splits: eq(members, 12000), category: 'Travel', createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: uid(), groupId: group.id, description: 'Seafood dinner', amount: 3200, paidBy: charlie.id, splitType: 'equal', splits: eq(members, 3200), category: 'Food', createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
    { id: uid(), groupId: group.id, description: 'Scuba diving', amount: 4500, paidBy: alice.id, splitType: 'unequal', splits: [{ memberId: alice.id, amount: 1500 }, { memberId: bob.id, amount: 1500 }, { memberId: diana.id, amount: 1500 }], category: 'Entertainment', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: uid(), groupId: group.id, description: 'Beach shack drinks', amount: 1800, paidBy: diana.id, splitType: 'equal', splits: eq(members, 1800), category: 'Food', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  ];

  return { groups: [group], expenses };
}

const Ctx = createContext<StoreCtx | null>(null);
const STORAGE_KEY = 'paymatrix_v1';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>({ groups: [], expenses: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  const addGroup = useCallback((d: { name: string; type: GroupType; memberNames: string[] }): Group => {
    const g: Group = {
      id: uid(), name: d.name, type: d.type, inviteCode: icode(),
      createdAt: new Date().toISOString(),
      members: d.memberNames.filter(Boolean).map((name, i) => ({ id: uid(), name, color: MEMBER_COLORS[i % MEMBER_COLORS.length] })),
    };
    setState(p => ({ ...p, groups: [...p.groups, g] }));
    return g;
  }, []);

  const addMember = useCallback((groupId: string, name: string) => {
    setState(p => ({
      ...p, groups: p.groups.map(g => g.id === groupId
        ? { ...g, members: [...g.members, { id: uid(), name, color: MEMBER_COLORS[g.members.length % MEMBER_COLORS.length] }] }
        : g),
    }));
  }, []);

  const removeMember = useCallback((groupId: string, memberId: string) => {
    setState(p => {
      const isReferenced = p.expenses.some(e =>
        e.groupId === groupId &&
        (e.paidBy === memberId || e.splits.some(s => s.memberId === memberId))
      );

      if (isReferenced) return p;

      return {
        ...p,
        groups: p.groups.map(g => g.id === groupId
          ? { ...g, members: g.members.filter(m => m.id !== memberId) }
          : g),
      };
    });
  }, []);

  const addExpense = useCallback((e: Omit<Expense, 'id' | 'createdAt'>) => {
    setState(p => ({ ...p, expenses: [...p.expenses, { ...e, id: uid(), createdAt: new Date().toISOString() }] }));
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setState(p => ({ ...p, expenses: p.expenses.filter(e => e.id !== id) }));
  }, []);

  const getGroup = useCallback((id: string) => state.groups.find(g => g.id === id), [state.groups]);
  const getGroupExpenses = useCallback((gid: string) => state.expenses.filter(e => e.groupId === gid), [state.expenses]);

  const getNetBalances = useCallback((groupId: string): Record<string, number> => {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return {};
    const bal: Record<string, number> = {};
    group.members.forEach(m => (bal[m.id] = 0));
    state.expenses.filter(e => e.groupId === groupId).forEach(exp => {
      bal[exp.paidBy] = (bal[exp.paidBy] || 0) + exp.amount;
      exp.splits.forEach(s => { bal[s.memberId] = (bal[s.memberId] || 0) - s.amount; });
    });
    return bal;
  }, [state]);

  const loadDemo = useCallback(() => { setState(makeDemoData()); }, []);

  return (
    <Ctx.Provider value={{ ...state, addGroup, addMember, removeMember, addExpense, deleteExpense, getGroup, getGroupExpenses, getNetBalances, loadDemo }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore outside StoreProvider');
  return c;
}
