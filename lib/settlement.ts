import type { Member } from './store';

export interface Transaction { from: string; to: string; amount: number; }

/** Min-cash-flow greedy algorithm — minimizes number of transactions */
export function calculateSettlements(
  netBalances: Record<string, number>,
  members: Member[],
): Transaction[] {
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

/** Naive upper-bound: max(debtors, creditors) without optimization */
export function naiveTransactionCount(netBalances: Record<string, number>): number {
  const vals = Object.values(netBalances);
  return Math.max(
    vals.filter(v => v < -0.01).length,
    vals.filter(v => v >  0.01).length,
  );
}
