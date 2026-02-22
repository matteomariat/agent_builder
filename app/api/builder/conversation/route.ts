import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ensureDefaultUser } from "@/lib/db/users";
import { randomUUID } from "crypto";

export async function GET() {
  const userId = await ensureDefaultUser();

  const existing = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.userId, userId),
      eq(conversations.isBuilder, true)
    ),
    columns: { id: true, title: true },
  });

  if (existing) {
    return NextResponse.json({
      conversationId: existing.id,
      title: existing.title ?? "AI Builder",
    });
  }

  const id = randomUUID();
  const now = new Date();
  await db.insert(conversations).values({
    id,
    userId,
    title: "AI Builder",
    masterAgentId: null,
    isBuilder: true,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({
    conversationId: id,
    title: "AI Builder",
  });
}
