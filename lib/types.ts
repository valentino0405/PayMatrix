export type SplitType = 'equal' | 'unequal' | 'percentage';

export type ExpenseCategory = 'food' | 'travel' | 'bills' | 'entertainment' | 'shopping' | 'other';

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
    food: 'hsl(var(--chart-3))',
    travel: 'hsl(var(--chart-5))',
    bills: 'hsl(var(--chart-4))',
    entertainment: 'hsl(var(--chart-1))',
    shopping: 'hsl(var(--chart-2))',
    other: 'hsl(var(--muted-foreground))',
};

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
    food: '🍔 Food',
    travel: '✈️ Travel',
    bills: '📄 Bills',
    entertainment: '🎬 Entertainment',
    shopping: '🛍️ Shopping',
    other: '📦 Other',
};

export interface Member {
    id: string;
    name: string;
    avatar?: string;
}

export interface Expense {
    id: string;
    groupId: string;
    description: string;
    amount: number;
    paidBy: string; // member id
    splitType: SplitType;
    splits: Record<string, number>; // memberId -> amount owed
    category: ExpenseCategory;
    date: string;
    note?: string;
    settled?: boolean;
}

export interface Group {
    id: string;
    name: string;
    members: Member[];
    expenses: Expense[];
    createdAt: string;
}

export interface Settlement {
    from: string; // member id
    to: string;   // member id
    amount: number;
}
