"use server";

import { auth } from "@clerk/nextjs/server";
import { syncUser } from "@/app/actions/userActions";
import { db } from "@/lib/prisma";
import {
  Category,
  Expense,
  Group,
  GroupType,
  MEMBER_COLORS,
  SplitType,
} from "@/lib/groupTypes";
import { unstable_cache, revalidatePath } from "next/cache";

type CreateGroupInput = {
  name: string;
  type: GroupType;
  memberNames: string[];
};

type CreateExpenseInput = {
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  splits: { memberId: string; amount: number }[];
  category: Category;
};

type GroupData = { group: Group; expenses: Expense[] };

function logActionError(functionName: string, error: unknown) {
  console.log(`${functionName} :`, error);
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return e.code === "P2021" || (typeof e.message === "string" && e.message.includes("does not exist"));
}

function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function decimalToNumber(v: { toString(): string } | number) {
  if (typeof v === "number") return v;
  return Number(v.toString());
}

async function generateUniqueInviteCode() {
  for (let i = 0; i < 8; i++) {
    const code = makeInviteCode();
    const exists = await db.group.findUnique({ where: { inviteCode: code } });
    if (!exists) return code;
  }
  throw new Error("Failed to generate a unique invite code");
}

const cachedUserGroups = unstable_cache(
  async (userId: string) => {
    const groups = await db.group.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        members: {
          orderBy: { createdAt: "asc" },
        },
        expenses: {
          orderBy: { createdAt: "desc" },
          include: {
            splits: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const mappedGroups: Group[] = groups.map((group) => ({
      id: group.id,
      name: group.name,
      type: group.type,
      inviteCode: group.inviteCode,
      createdAt: group.createdAt.toISOString(),
      members: group.members.map((member) => ({
        id: member.id,
        name: member.displayName,
        color: member.color,
      })),
    }));

    const mappedExpenses: Expense[] = groups.flatMap((group) =>
      group.expenses.map((expense) => ({
        id: expense.id,
        groupId: expense.groupId,
        description: expense.description,
        amount: decimalToNumber(expense.amount),
        paidBy: expense.paidByMemberId,
        splitType: expense.splitType,
        category: expense.category,
        createdAt: expense.createdAt.toISOString(),
        splits: expense.splits.map((split) => ({
          memberId: split.memberId,
          amount: decimalToNumber(split.amount),
        })),
      })),
    );

    return {
      groups: mappedGroups,
      expenses: mappedExpenses,
    };
  },
  ["user-groups"],
  { revalidate: 120 },
);

const cachedGroupData = unstable_cache(
  async (groupId: string, userId: string): Promise<GroupData | null> => {
    const group = await db.group.findFirst({
      where: {
        id: groupId,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        members: { orderBy: { createdAt: "asc" } },
        expenses: {
          include: { splits: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!group) return null;

    return {
      group: {
        id: group.id,
        name: group.name,
        type: group.type,
        inviteCode: group.inviteCode,
        createdAt: group.createdAt.toISOString(),
        members: group.members.map((m) => ({
          id: m.id,
          name: m.displayName,
          color: m.color,
        })),
      },
      expenses: group.expenses.map((e) => ({
        id: e.id,
        groupId: e.groupId,
        description: e.description,
        amount: decimalToNumber(e.amount),
        paidBy: e.paidByMemberId,
        splitType: e.splitType,
        category: e.category,
        createdAt: e.createdAt.toISOString(),
        splits: e.splits.map((s) => ({ memberId: s.memberId, amount: decimalToNumber(s.amount) })),
      })),
    };
  },
  ["group-data"],
  { revalidate: 120 },
);

export async function fetchUserGroups() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return { groups: [] as Group[], expenses: [] as Expense[] };
    }

    const user = await syncUser();
    if (!user?.id) return { groups: [] as Group[], expenses: [] as Expense[] };

    return await cachedUserGroups(user.id);
  } catch (error) {
    logActionError("fetchUserGroups", error);
    if (isMissingTableError(error)) {
      return { groups: [] as Group[], expenses: [] as Expense[] };
    }
    return { groups: [] as Group[], expenses: [] as Expense[] };
  }
}

export async function fetchGroupDataAction(groupId: string): Promise<GroupData | null> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return null;

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!user?.id) return null;

    return await cachedGroupData(groupId, user.id);
  } catch (error) {
    logActionError("fetchGroupDataAction", error);
    if (isMissingTableError(error)) {
      return null;
    }
    return null;
  }
}

export async function createGroupAction(input: CreateGroupInput): Promise<Group> {
  try {
    const name = input.name.trim();
    const memberNames = input.memberNames.map((m) => m.trim()).filter(Boolean);

    if (!name) throw new Error("Group name is required");
    if (memberNames.length < 2) throw new Error("Add at least 2 members");

    const user = await syncUser();
    if (!user?.id) {
      throw new Error("Unauthorized");
    }

    const inviteCode = await generateUniqueInviteCode();

    const created = await db.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name,
          type: input.type,
          inviteCode,
          ownerId: user.id,
        },
      });

      const members = await Promise.all(
        memberNames.map((memberName, idx) =>
          tx.groupMember.create({
            data: {
              groupId: group.id,
              displayName: memberName,
              color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
            },
            select: { id: true, displayName: true, color: true },
          }),
        ),
      );

      return { group, members };
    });

    revalidatePath("/dashboard");

    return {
      id: created.group.id,
      name: created.group.name,
      type: created.group.type,
      inviteCode: created.group.inviteCode,
      createdAt: created.group.createdAt.toISOString(),
      members: created.members.map((m) => ({ id: m.id, name: m.displayName, color: m.color })),
    };
  } catch (error) {
    logActionError("createGroupAction", error);
    throw error;
  }
}

export async function createExpenseAction(input: CreateExpenseInput): Promise<Expense> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) throw new Error("Unauthorized");

    const user = await syncUser();
    if (!user?.id) throw new Error("Unauthorized");

    const accessibleGroup = await db.group.findFirst({
      where: {
        id: input.groupId,
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
      },
      select: { id: true },
    });
    if (!accessibleGroup) throw new Error("Forbidden");

    if (!input.description.trim()) throw new Error("Description is required");
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Invalid amount");
    if (!input.splits.length) throw new Error("Expense splits are required");

    const created = await db.expense.create({
      data: {
        groupId: input.groupId,
        createdById: user.id,
        paidByMemberId: input.paidBy,
        description: input.description.trim(),
        amount: input.amount,
        splitType: input.splitType,
        category: input.category,
        splits: {
          create: input.splits.map((s) => ({
            memberId: s.memberId,
            amount: s.amount,
            percentage: input.splitType === "percentage" && input.amount > 0
              ? (s.amount / input.amount) * 100
              : null,
          })),
        },
      },
      include: { splits: true },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/groups/${input.groupId}`);
    revalidatePath(`/groups/${input.groupId}/balances`);
    revalidatePath(`/groups/${input.groupId}/graph`);
    revalidatePath(`/groups/${input.groupId}/settle`);

    return {
      id: created.id,
      groupId: created.groupId,
      description: created.description,
      amount: decimalToNumber(created.amount),
      paidBy: created.paidByMemberId,
      splitType: created.splitType,
      category: created.category,
      createdAt: created.createdAt.toISOString(),
      splits: created.splits.map((s) => ({
        memberId: s.memberId,
        amount: decimalToNumber(s.amount),
      })),
    };
  } catch (error) {
    logActionError("createExpenseAction", error);
    throw error;
  }
}

export async function deleteExpenseAction(expenseId: string): Promise<{ ok: true }> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) throw new Error("Unauthorized");

    const user = await syncUser();
    if (!user?.id) throw new Error("Unauthorized");

    const expense = await db.expense.findUnique({
      where: { id: expenseId },
      select: { id: true, groupId: true, group: { select: { ownerId: true, members: { select: { userId: true } } } } },
    });

    if (!expense) {
      return { ok: true };
    }

    const allowed =
      expense.group.ownerId === user.id ||
      expense.group.members.some((m) => m.userId === user.id);
    if (!allowed) throw new Error("Forbidden");

    await db.expense.delete({ where: { id: expenseId } });

    revalidatePath("/dashboard");
    revalidatePath(`/groups/${expense.groupId}`);
    revalidatePath(`/groups/${expense.groupId}/balances`);
    revalidatePath(`/groups/${expense.groupId}/graph`);
    revalidatePath(`/groups/${expense.groupId}/settle`);

    return { ok: true };
  } catch (error) {
    logActionError("deleteExpenseAction", error);
    throw error;
  }
}
