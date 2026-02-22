import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, masterAgents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getDefaultUserId();
  const row = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
  });
  if (!row) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  let masterAgentName: string | null = null;
  if (row.masterAgentId) {
    const ma = await db.query.masterAgents.findFirst({
      where: eq(masterAgents.id, row.masterAgentId),
      columns: { name: true },
    });
    masterAgentName = ma?.name ?? null;
  }
  return NextResponse.json({
    ...row,
    masterAgentName,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getDefaultUserId();
  const row = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
  });
  if (!row) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  let body: { title?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : row.title;
  const now = new Date();
  await db
    .update(conversations)
    .set({ title, updatedAt: now })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return NextResponse.json({
    ...row,
    title,
    updatedAt: now.toISOString(),
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getDefaultUserId();
  const row = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
  });
  if (!row) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return new NextResponse(null, { status: 204 });
}
