"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function syncUser() {
  try {
    const { userId } = await auth();

    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Get full user info from Clerk
    const clerkUser = await currentUser();

    if (!clerkUser) {
      throw new Error("Clerk user not found");
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress || "";
    const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();

    // Upsert avoids duplicate create races and keeps profile fields fresh.
    const user = await db.user.upsert({
      where: { clerkId: userId },
      update: {
        email,
        name,
        username: clerkUser.username || "",
        avatarUrl: clerkUser.imageUrl,
      },
      create: {
        clerkId: userId,
        email,
        name,
        username: clerkUser.username || "",
        avatarUrl: clerkUser.imageUrl,
      },
    });

    return user;
  } catch (error) {
    console.error("SYNC USER ERROR:", error);
    throw error;
  }
}