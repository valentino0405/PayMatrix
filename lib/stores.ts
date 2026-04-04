import { Group, Expense, Member } from "./types"

// Demo data
export const demoMembers: Member[] = [
    { id: "m1", name: "Alex" },
    { id: "m2", name: "Jordan" },
    { id: "m3", name: "Sam" },
    { id: "m4", name: "Riley" },
]

export const demoExpenses: Expense[] = [
    {
        id: "e1",
        groupId: "g1",
        description: "Dinner",
        amount: 120,
        paidBy: "m1",
        splitType: "equal",
        splits: { m1: 30, m2: 30, m3: 30, m4: 30 },
        category: "food",
        date: "2026-03-28",
    },
    {
        id: "e2",
        groupId: "g1",
        description: "Uber",
        amount: 45,
        paidBy: "m2",
        splitType: "equal",
        splits: { m1: 15, m2: 15, m3: 15 },
        category: "travel",
        date: "2026-03-29",
    },
    {
        id: "e3",
        groupId: "g1",
        description: "Hotel",
        amount: 400,
        paidBy: "m3",
        splitType: "equal",
        splits: { m1: 100, m2: 100, m3: 100, m4: 100 },
        category: "bills",
        date: "2026-03-30",
    },
    {
        id: "e4",
        groupId: "g1",
        description: "Movie",
        amount: 60,
        paidBy: "m1",
        splitType: "equal",
        splits: { m1: 15, m2: 15, m3: 15, m4: 15 },
        category: "entertainment",
        date: "2026-03-31",
    },
    {
        id: "e5",
        groupId: "g1",
        description: "Groceries",
        amount: 85,
        paidBy: "m4",
        splitType: "equal",
        splits: { m1: 21.25, m2: 21.25, m3: 21.25, m4: 21.25 },
        category: "food",
        date: "2026-04-01",
    },
    {
        id: "e6",
        groupId: "g1",
        description: "Shopping",
        amount: 70,
        paidBy: "m2",
        splitType: "equal",
        splits: { m1: 17.5, m2: 17.5, m3: 17.5, m4: 17.5 },
        category: "shopping",
        date: "2026-04-02",
    },
]

export const demoGroups: Group[] = [
    {
        id: "g1",
        name: "Weekend Trip 🏖️",
        members: demoMembers,
        expenses: demoExpenses,
        createdAt: "2026-03-25",
    },
]