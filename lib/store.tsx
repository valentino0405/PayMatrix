'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

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
  unread?: boolean;
  paymentStatus?: 'pending' | 'done' | 'none';
  paidAmount?: number;
  remainingAmount?: number;
  totalPayableAmount?: number;
  lastUpdateType?: 'created' | 'accepted' | 'balance_updated' | 'settled' | 'unsettled' | 'note_updated';
  lastUpdatedAt?: string;
  status: 'accepted' | 'pending';
  createdAt: string;
}

export interface Member { id: string; name: string; color: string; email?: string; }
export interface ExpenseSplit { memberId: string; amount: number; }
export interface Expense {
  id: string; groupId: string; description: string; amount: number;
  paidBy: string; splitType: SplitType; splits: ExpenseSplit[];
  originalAmount?: number;
  originalCurrency?: string;
  conversionRate?: number;
  category: Category; isSuspicious?: boolean; createdAt: string;
}
export interface Settlement {
  from: string; to: string; amount: number; groupId: string; paymentTransactionId?: string;
}
export interface PaymentTxn {
  from: string; to: string; amount: number; groupId: string; status: string;
}
export interface Group {
  id: string; name: string; type: GroupType;
  members: Member[]; inviteCode: string; monthlyBudget?: number; createdViaScan?: boolean; createdAt: string;
}

export const MEMBER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316'];

const isJsonResponse = (res: Response) => (res.headers.get('content-type') ?? '').includes('application/json');

// Normalize MongoDB _id → id
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ng = (g: any): Group => ({
  id: String(g._id ?? g.id),
  name: g.name,
  type: g.type,
  members: (g.members ?? []).map((m: Member) => ({ ...m })),
  inviteCode: g.inviteCode,
  monthlyBudget: g.monthlyBudget,
  createdViaScan: Boolean(g.createdViaScan),
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
  originalAmount: e.originalAmount !== undefined ? Number(e.originalAmount) : undefined,
  originalCurrency: e.originalCurrency,
  conversionRate: e.conversionRate !== undefined ? Number(e.conversionRate) : undefined,
  category: e.category ?? 'Other',
  isSuspicious: e.isSuspicious ?? false,
  createdAt: e.createdAt,
});

interface StoreCtx {
  groups: Group[]; expenses: Expense[]; friends: Friend[]; loading: boolean; friendsLoading: boolean;
  addGroup: (d: { name: string; type: GroupType; members: { name: string; email?: string }[]; createdViaScan?: boolean }) => Promise<Group>;
  deleteGroup: (groupId: string) => Promise<void>;
  updateGroupName: (groupId: string, name: string) => Promise<void>;
  updateGroupBudget: (groupId: string, budget: number | undefined) => Promise<void>;
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
  refreshFriends: () => Promise<void>;
  // Friend functions (all MongoDB-backed now)
  addFriend: (name: string, balance: number) => void; // kept for backward compat
  inviteFriend: (email: string, balance: number, note?: string) => Promise<{ success: boolean; inviteUrl?: string; message?: string; error?: string }>;
  settleFriend: (id: string) => Promise<void>;
  unsettleFriend: (id: string) => Promise<void>;
  updateFriendBalance: (id: string, balance: number) => Promise<void>;
  markFriendRead: (id: string) => Promise<void>;
  deleteFriend: (id: string) => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [groups, setGroups]     = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [payments, setPayments] = useState<PaymentTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends]   = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  // ── Core fetch: load all groups + all their expenses ────────────────────────
  const refreshGroups = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setGroups([]);
      setExpenses([]);
      setSettlements([]);
      setPayments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/groups');
      if (!res.ok || !isJsonResponse(res)) {
        setGroups([]);
        setExpenses([]);
        setSettlements([]);
        setPayments([]);
        return;
      }

      const rawGroups = await res.json();
      const gs: Group[] = rawGroups.map(ng);
      setGroups(gs);

      if (gs.length === 0) { setExpenses([]); return; }

      // Fetch expenses for all groups in parallel
      const expArrays = await Promise.all(
        gs.map(async (g) => {
          try {
            const r = await fetch(`/api/groups/${g.id}/expenses`);
            if (!r.ok || !isJsonResponse(r)) return [];
            const raw = await r.json();
            return Array.isArray(raw) ? raw.map(ne) : [];
          } catch { return []; }
        })
      );
      
      // RESOLVED CONFLICT: Used expArrays correctly
      setExpenses(expArrays.flat());

      // Load settlements for all groups in parallel
      const allSettlements = await Promise.all(
        gs.map(g =>
          fetch(`/api/groups/${g.id}/settlements`)
            .then(r => (r.ok && isJsonResponse(r) ? r.json() : []))
            .then(arr => arr.map((s: any) => ({ ...s, groupId: g.id })))
        )
      );
      setSettlements(allSettlements.flat());

      // Load successful payments for all groups
      const allPayments = await Promise.all(
        gs.map(g =>
          fetch(`/api/groups/${g.id}/payments?status=success`)
            .then(r => (r.ok && isJsonResponse(r) ? r.json() : []))
            .then(arr => arr.map((p: any) => ({ ...p, groupId: g.id })))
        )
      );
      setPayments(allPayments.flat());
    } catch (err) { 
      console.error('refreshGroups error:', err); 
    }
    finally { setLoading(false); }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    refreshGroups();
  }, [isLoaded, refreshGroups]);

  /* ── Friends (MongoDB) ────────────────────────────────────────────── */
  const refreshFriends = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setFriends([]);
      setFriendsLoading(false);
      return;
    }

    try {
      setFriendsLoading(true);
      const res = await fetch('/api/friends');
      if (!res.ok || !isJsonResponse(res)) { setFriends([]); return; }
      const raw = await res.json();
      setFriends(Array.isArray(raw) ? raw : []);
    } catch (err) { console.error('refreshFriends:', err); }
    finally { setFriendsLoading(false); }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    refreshFriends();
  }, [isLoaded, refreshFriends]);

  // ── addGroup ─────────────────────────────────────────────────────────────────
  const addGroup = useCallback(async (d: { name: string; type: GroupType; members: { name: string; email?: string }[]; createdViaScan?: boolean }): Promise<Group> => {
    const res = await fetch('/api/groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
    });
    if (!res.ok) throw new Error('Failed to create group');
    const raw = await res.json();
    const g = ng(raw);
    setGroups(p => [g, ...p]);
    return g;
  }, []);

  // ── deleteGroup ─────────────────────────────────────────────────────────────
  const deleteGroup = useCallback(async (groupId: string) => {
    const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error('Failed to delete group');
    }

    setGroups(p => p.filter(g => g.id !== groupId));
    setExpenses(p => p.filter(e => e.groupId !== groupId));
    setSettlements(p => p.filter(s => s.groupId !== groupId));
    setPayments(p => p.filter(txn => txn.groupId !== groupId));
  }, []);

  // ── updateGroupName ─────────────────────────────────────────────────────────
  const updateGroupName = useCallback(async (groupId: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Group name cannot be empty');
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!res.ok) throw new Error();
      setGroups(p => p.map(g => g.id === groupId ? { ...g, name: trimmedName } : g));
    } catch {
      throw new Error('Failed to update group name');
    }
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
    setFriends(p => p.map(f => f.id === id ? {
      ...f,
      settled: true,
      balance: 0,
      settledAt: new Date().toISOString(),
      paymentStatus: 'done',
      unread: false,
      lastUpdateType: 'settled',
      lastUpdatedAt: new Date().toISOString(),
    } : f));
  }, []);

  const unsettleFriend = useCallback(async (id: string) => {
    await fetch(`/api/friends/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settled: false }),
    });
    setFriends(p => p.map(f => f.id === id ? {
      ...f,
      settled: false,
      settledAt: undefined,
      paymentStatus: Math.abs(f.balance) > 0 ? 'pending' : 'none',
      unread: false,
      lastUpdateType: 'unsettled',
      lastUpdatedAt: new Date().toISOString(),
    } : f));
  }, []);

  const updateFriendBalance = useCallback(async (id: string, balance: number) => {
    await fetch(`/api/friends/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance }),
    });
    setFriends(p => p.map(f => f.id === id ? {
      ...f,
      balance,
      settled: false,
      paymentStatus: Math.abs(balance) > 0 ? 'pending' : 'none',
      unread: false,
      lastUpdateType: 'balance_updated',
      lastUpdatedAt: new Date().toISOString(),
    } : f));
  }, []);

  const markFriendRead = useCallback(async (id: string) => {
    const res = await fetch(`/api/friends/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markRead: true }),
    });
    if (!res.ok) throw new Error('Failed to mark friend update as read');
    setFriends(p => p.map(f => f.id === id ? { ...f, unread: false } : f));
  }, []);

  const deleteFriend = useCallback(async (id: string) => {
    const res = await fetch(`/api/friends/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error('Failed to delete friend');
    }
    setFriends(p => p.filter(f => f.id !== id));
  }, []);

  // RESOLVED CONFLICT: Cleanly exporting ALL combined functions
  return (
    <Ctx.Provider value={{
      groups, expenses, friends, loading, friendsLoading,
      addGroup, deleteGroup, updateGroupName, addMember, removeMember, updateGroupBudget, addExpense, deleteExpense,
      getGroup, getGroupExpenses, getGroupSettlements, getGroupPayments, getNetBalances, refreshGroups, refreshFriends,
      addFriend, inviteFriend, settleFriend, unsettleFriend, updateFriendBalance, markFriendRead, deleteFriend,
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
