import { NextRequest, NextResponse } from "next/server";
import { conversations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";
import { listDocsByConversationId, createDoc } from "@/lib/db/doc";
import { db } from "@/lib/db";

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
  const docs = await listDocsByConversationId(conversationId);
  return NextResponse.json({
    docs: docs.map((d) => ({
      id: d.id,
      title: d.title,
      updatedAt: d.updatedAt?.toISOString?.() ?? null,
    })),
  });
}

export async function POST(
  request: NextRequest,
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
  let body: { title?: string; content?: string } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    // empty body ok
  }
  const created = await createDoc(conversationId, {
    title: body.title,
    content: body.content,
  });
  if (!created) {
    return NextResponse.json({ error: "Failed to create doc" }, { status: 500 });
  }
  return NextResponse.json({
    id: created.id,
    title: created.title,
    updatedAt: created.updatedAt?.toISOString?.() ?? null,
  });
}
