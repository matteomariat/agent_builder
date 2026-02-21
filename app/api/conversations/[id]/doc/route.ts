import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, workingDocs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";
import { randomUUID } from "crypto";

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
  let doc = await db.query.workingDocs.findFirst({
    where: eq(workingDocs.conversationId, conversationId),
  });
  if (!doc) {
    const docId = randomUUID();
    await db.insert(workingDocs).values({
      id: docId,
      conversationId,
      content: "",
      updatedAt: new Date(),
    });
    doc = await db.query.workingDocs.findFirst({
      where: eq(workingDocs.conversationId, conversationId),
    });
  }
  return NextResponse.json({
    id: doc?.id,
    content: doc?.content ?? "",
    lockHolder: doc?.lockHolder ?? null,
    lockExpiresAt: doc?.lockExpiresAt?.toISOString?.() ?? null,
    updatedAt: doc?.updatedAt?.toISOString?.() ?? null,
  });
}

export async function PATCH(
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
  let body: { content?: string; lockHolder?: "user" | "agent" | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  let doc = await db.query.workingDocs.findFirst({
    where: eq(workingDocs.conversationId, conversationId),
  });
  if (!doc) {
    const docId = randomUUID();
    await db.insert(workingDocs).values({
      id: docId,
      conversationId,
      content: body.content ?? "",
      lockHolder: body.lockHolder ?? null,
      updatedAt: new Date(),
    });
    doc = await db.query.workingDocs.findFirst({
      where: eq(workingDocs.conversationId, conversationId),
    });
  }
  if (body.content !== undefined) {
    if (doc?.lockHolder === "agent") {
      return NextResponse.json(
        { error: "Doc is being edited by the agent" },
        { status: 409 }
      );
    }
    const now = new Date();
    await db
      .update(workingDocs)
      .set({
        content: body.content,
        lockHolder: body.lockHolder ?? doc?.lockHolder ?? null,
        updatedAt: now,
      })
      .where(eq(workingDocs.conversationId, conversationId));
  } else if (body.lockHolder !== undefined) {
    await db
      .update(workingDocs)
      .set({
        lockHolder: body.lockHolder,
        updatedAt: new Date(),
      })
      .where(eq(workingDocs.conversationId, conversationId));
  }
  const updated = await db.query.workingDocs.findFirst({
    where: eq(workingDocs.conversationId, conversationId),
  });
  return NextResponse.json({
    id: updated?.id,
    content: updated?.content ?? "",
    lockHolder: updated?.lockHolder ?? null,
    lockExpiresAt: updated?.lockExpiresAt?.toISOString?.() ?? null,
    updatedAt: updated?.updatedAt?.toISOString?.() ?? null,
  });
}
