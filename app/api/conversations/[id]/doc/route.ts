import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, workingDocs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";
import { getDefaultDocForConversation, createDoc } from "@/lib/db/doc";

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
  let doc = await getDefaultDocForConversation(conversationId);
  if (!doc) {
    const created = await createDoc(conversationId, {});
    doc = created ?? undefined;
  }
  const undoStack = parseJsonStringArray(doc?.undoStack);
  const redoStack = parseJsonStringArray(doc?.redoStack);
  return NextResponse.json({
    id: doc?.id,
    content: doc?.content ?? "",
    undoStack,
    redoStack,
    lockHolder: doc?.lockHolder ?? null,
    lockExpiresAt: doc?.lockExpiresAt?.toISOString?.() ?? null,
    updatedAt: doc?.updatedAt?.toISOString?.() ?? null,
  });
}

function parseJsonStringArray(raw: string | undefined): string[] {
  if (raw == null || raw === "") return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const UNDO_REDO_CAP = 30;

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
  let body: {
    content?: string;
    lockHolder?: "user" | "agent" | null;
    undoStack?: string[];
    redoStack?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  let doc = await getDefaultDocForConversation(conversationId);
  if (!doc) {
    const created = await createDoc(conversationId, { content: body.content ?? "" });
    doc = created ?? undefined;
  }
  if (!doc) {
    return NextResponse.json({ error: "Doc not found" }, { status: 500 });
  }
  if (body.content !== undefined) {
    if (doc?.lockHolder === "agent") {
      return NextResponse.json(
        { error: "Doc is being edited by the agent" },
        { status: 409 }
      );
    }
    const now = new Date();
    let undoStack: string[];
    let redoStack: string[];
    if (body.undoStack !== undefined && body.redoStack !== undefined) {
      undoStack = body.undoStack.slice(0, UNDO_REDO_CAP);
      redoStack = body.redoStack.slice(0, UNDO_REDO_CAP);
    } else {
      const prev = parseJsonStringArray(doc?.undoStack);
      const contentChanged = body.content !== (doc?.content ?? "");
      undoStack = contentChanged ? [doc?.content ?? "", ...prev].slice(0, UNDO_REDO_CAP) : prev;
      redoStack = contentChanged ? [] : parseJsonStringArray(doc?.redoStack);
    }
    await db
      .update(workingDocs)
      .set({
        content: body.content,
        undoStack: JSON.stringify(undoStack),
        redoStack: JSON.stringify(redoStack),
        lockHolder: body.lockHolder ?? doc?.lockHolder ?? null,
        updatedAt: now,
      })
      .where(eq(workingDocs.id, doc.id));
  } else if (body.lockHolder !== undefined) {
    await db
      .update(workingDocs)
      .set({
        lockHolder: body.lockHolder,
        updatedAt: new Date(),
      })
      .where(eq(workingDocs.id, doc.id));
  }
  const updated = await db.query.workingDocs.findFirst({
    where: eq(workingDocs.id, doc.id),
  });
  return NextResponse.json({
    id: updated?.id,
    content: updated?.content ?? "",
    undoStack: parseJsonStringArray(updated?.undoStack),
    redoStack: parseJsonStringArray(updated?.redoStack),
    lockHolder: updated?.lockHolder ?? null,
    lockExpiresAt: updated?.lockExpiresAt?.toISOString?.() ?? null,
    updatedAt: updated?.updatedAt?.toISOString?.() ?? null,
  });
}
