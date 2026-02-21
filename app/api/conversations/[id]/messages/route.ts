import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const userId = getDefaultUserId();
  const conv = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.userId, userId)
    ),
  });
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  const list = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    columns: { id: true, role: true, content: true, createdAt: true },
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });
  return NextResponse.json(
    list.map((m) => ({
      ...m,
      createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
    }))
  );
}
