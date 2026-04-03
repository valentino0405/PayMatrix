import { Expense, Settlement } from "./types"

/**
 * Compute net balances for each member
 * +ve → should receive money
 * -ve → owes money
 */
export function computeNetBalances(
    expenses: Expense[]
): Record<string, number> {
    const balances: Record<string, number> = {}

    for (const expense of expenses) {
        if (expense.settled) continue

        // payer gets credit
        balances[expense.paidBy] =
            (balances[expense.paidBy] || 0) + expense.amount

        // participants owe their share
        for (const [memberId, amount] of Object.entries(expense.splits)) {
            balances[memberId] =
                (balances[memberId] || 0) - amount
        }
    }

    return balances
}

/**
 * Optimized settlements (Min Cash Flow)
 */
export function optimizeSettlements(
    balances: Record<string, number>
): Settlement[] {
    const settlements: Settlement[] = []

    const entries = Object.entries(balances)
        .map(([id, amount]) => ({
            id,
            amount: Math.round(amount * 100) / 100,
        }))
        .filter((e) => Math.abs(e.amount) > 0.01)

    const creditors = entries
        .filter((e) => e.amount > 0)
        .sort((a, b) => b.amount - a.amount)

    const debtors = entries
        .filter((e) => e.amount < 0)
        .sort((a, b) => a.amount - b.amount)

    let ci = 0
    let di = 0

    while (ci < creditors.length && di < debtors.length) {
        const credit = creditors[ci].amount
        const debt = Math.abs(debtors[di].amount)
        const settleAmount = Math.min(credit, debt)

        if (settleAmount > 0.01) {
            settlements.push({
                from: debtors[di].id,
                to: creditors[ci].id,
                amount: Math.round(settleAmount * 100) / 100,
            })
        }

        creditors[ci].amount -= settleAmount
        debtors[di].amount += settleAmount

        if (creditors[ci].amount < 0.01) ci++
        if (Math.abs(debtors[di].amount) < 0.01) di++
    }

    return settlements
}

/**
 * Naive settlements (no optimization)
 */
export function naiveSettlements(
    expenses: Expense[]
): Settlement[] {
    const settlements: Settlement[] = []
    const owes: Record<string, Record<string, number>> = {}

    for (const expense of expenses) {
        if (expense.settled) continue

        for (const [memberId, amount] of Object.entries(expense.splits)) {
            if (memberId === expense.paidBy) continue

            if (!owes[memberId]) owes[memberId] = {}

            owes[memberId][expense.paidBy] =
                (owes[memberId][expense.paidBy] || 0) + amount
        }
    }

    for (const [from, tos] of Object.entries(owes)) {
        for (const [to, amount] of Object.entries(tos)) {
            if (amount > 0.01) {
                settlements.push({
                    from,
                    to,
                    amount: Math.round(amount * 100) / 100,
                })
            }
        }
    }

    return settlements
}