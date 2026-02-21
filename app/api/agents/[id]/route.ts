import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getDefaultUserId();
  const row = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.userId, userId)),
  });
  if (!row) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...row,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getDefaultUserId();
  let body: { name?: string; systemPrompt?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const existing = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.userId, userId)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  const updates: { name?: string; systemPrompt?: string; model?: string | null } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    updates.name = body.name.trim();
  }
  if (body.systemPrompt !== undefined) {
    if (typeof body.systemPrompt !== "string") {
      return NextResponse.json({ error: "systemPrompt must be string" }, { status: 400 });
    }
    updates.systemPrompt = body.systemPrompt.trim();
  }
  if (body.model !== undefined) {
    updates.model = body.model && typeof body.model === "string" ? body.model.trim() : null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(existing);
  }
  await db
    .update(agents)
    .set(updates)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)));
  const row = await db.query.agents.findFirst({
    where: eq(agents.id, id),
  });
  return NextResponse.json({
    ...row,
    createdAt: row?.createdAt?.toISOString?.() ?? row?.createdAt,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getDefaultUserId();
  const existing = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.userId, userId)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  await db.delete(agents).where(and(eq(agents.id, id), eq(agents.userId, userId)));
  return NextResponse.json({ ok: true });
}
