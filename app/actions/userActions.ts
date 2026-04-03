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

    // Check if user already exists
    let user = await db.user.findUnique({
      where: {
        clerkId: userId,
      },
    });

    // If NOT → create user
    if (!user) {
      user = await db.user.create({
        data: {
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress || "",
          name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`,
          username: clerkUser.username || "",
          avatarUrl: clerkUser.imageUrl,
        },
      });
    }

    return user;
  } catch (error) {
    console.error("SYNC USER ERROR:", error);
    throw error;
  }
}