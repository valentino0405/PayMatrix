export type GroupType = "Trip" | "Roommates" | "Event" | "Other";
export type SplitType = "equal" | "unequal" | "percentage";
export type Category =
  | "Food"
  | "Travel"
  | "Accommodation"
  | "Entertainment"
  | "Shopping"
  | "Utilities"
  | "Health"
  | "Other";

export interface Member {
  id: string;
  name: string;
  color: string;
}

export interface ExpenseSplit {
  memberId: string;
  amount: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  splits: ExpenseSplit[];
  category: Category;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  members: Member[];
  inviteCode: string;
  createdAt: string;
}

export const MEMBER_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];
