import type { Member, Expense } from './store';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Transaction { from: string; to: string; amount: number; }
export type Settlement = Transaction; // alias — same shape, sou2 calls it Settlement

// ── Balance computation (from sou2) ──────────────────────────────────────────
/** Compute net balances from raw expenses. +ve = should receive, -ve = owes */
export function computeNetBalances(expenses: Expense[]): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const expense of expenses) {
    balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;
    for (const split of expense.splits) {
      balances[split.memberId] = (balances[split.memberId] || 0) - split.amount;
    }
  }
  return balances;
}

// ── Optimized: Min-Cash-Flow reduce approach (val) ────────────────────────────
/** Used by existing pages — takes pre-computed balances + member list */
export function calculateSettlements(
  netBalances: Record<string, number>,
  members: Member[],
): Transaction[] {
  if (!members || members.length === 0) return [];

  const bal = members.map(m => ({
    id: m.id,
    amount: Math.round((netBalances[m.id] || 0) * 100) / 100,
  }));

  const txns: Transaction[] = [];
  const MAX_ITER = members.length * members.length + 10;

  for (let i = 0; i < MAX_ITER; i++) {
    const creditor = bal.reduce((a, b) => (b.amount > a.amount ? b : a));
    const debtor   = bal.reduce((a, b) => (b.amount < a.amount ? b : a));
    if (creditor.amount < 0.01 || debtor.amount > -0.01) break;

    const amt = Math.round(Math.min(creditor.amount, -debtor.amount) * 100) / 100;
    if (amt <= 0) break;

    txns.push({ from: debtor.id, to: creditor.id, amount: amt });
    creditor.amount = Math.round((creditor.amount - amt) * 100) / 100;
    debtor.amount   = Math.round((debtor.amount   + amt) * 100) / 100;
  }
  return txns;
}

// ── Optimized: two-pointer approach (sou2) ────────────────────────────────────
/** Takes raw balances map — slightly more efficient two-pointer variant */
export function optimizeSettlements(balances: Record<string, number>): Settlement[] {
  const settlements: Settlement[] = [];

  const entries = Object.entries(balances)
    .map(([id, amount]) => ({ id, amount: Math.round(amount * 100) / 100 }))
    .filter(e => Math.abs(e.amount) > 0.01);

  const creditors = entries.filter(e => e.amount > 0).sort((a, b) => b.amount - a.amount);
  const debtors   = entries.filter(e => e.amount < 0).sort((a, b) => a.amount - b.amount);

  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const settleAmount = Math.min(creditors[ci].amount, Math.abs(debtors[di].amount));
    if (settleAmount > 0.01) {
      settlements.push({
        from: debtors[di].id,
        to: creditors[ci].id,
        amount: Math.round(settleAmount * 100) / 100,
      });
    }
    creditors[ci].amount -= settleAmount;
    debtors[di].amount   += settleAmount;
    if (creditors[ci].amount < 0.01) ci++;
    if (Math.abs(debtors[di].amount) < 0.01) di++;
  }
  return settlements;
}

// ── Naive settlements — actual per-expense transactions (sou2) ────────────────
/** Returns raw unsimplified debts, one per expense share */
export function naiveSettlements(expenses: Expense[]): Settlement[] {
  const settlements: Settlement[] = [];
  const owes: Record<string, Record<string, number>> = {};

  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.memberId === expense.paidBy) continue;
      if (!owes[split.memberId]) owes[split.memberId] = {};
      owes[split.memberId][expense.paidBy] =
        (owes[split.memberId][expense.paidBy] || 0) + split.amount;
    }
  }

  for (const [from, tos] of Object.entries(owes)) {
    for (const [to, amount] of Object.entries(tos)) {
      if (amount > 0.01) {
        settlements.push({ from, to, amount: Math.round(amount * 100) / 100 });
      }
    }
  }
  return settlements;
}

// ── Naive count (val) ─────────────────────────────────────────────────────────
/** Quick upper-bound count without computing actual transactions */
export function naiveTransactionCount(netBalances: Record<string, number>): number {
  const vals = Object.values(netBalances);
  return Math.max(
    vals.filter(v => v < -0.01).length,
    vals.filter(v => v > 0.01).length,
  );
}
