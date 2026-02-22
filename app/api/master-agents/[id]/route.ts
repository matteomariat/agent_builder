import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { masterAgents, conversations } from "@/lib/db/schema";
import { ensureDefaultUser } from "@/lib/db/users";
import { getDefaultMasterAgentConfig } from "@/lib/db/master-agents";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await ensureDefaultUser();
  const row = await db.query.masterAgents.findFirst({
    where: and(eq(masterAgents.id, id), eq(masterAgents.userId, userId)),
  });
  if (!row) {
    return NextResponse.json({ error: "Master agent not found" }, { status: 404 });
  }
  const toolIds: string[] = (() => {
    if (!row.toolIds || typeof row.toolIds !== "string") return [];
    try {
      const arr = JSON.parse(row.toolIds);
      return Array.isArray(arr) ? arr.filter((id: unknown): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  })();
  return NextResponse.json({
    id: row.id,
    name: row.name,
    systemPrompt: row.systemPrompt,
    model: row.model,
    maxSteps: row.maxSteps,
    thinkingEnabled: row.thinkingEnabled,
    toolIds,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await ensureDefaultUser();
  const row = await db.query.masterAgents.findFirst({
    where: and(eq(masterAgents.id, id), eq(masterAgents.userId, userId)),
  });
  if (!row) {
    return NextResponse.json({ error: "Master agent not found" }, { status: 404 });
  }

  let body: {
    name?: string;
    systemPrompt?: string;
    model?: string | null;
    maxSteps?: number | null;
    thinkingEnabled?: boolean | null;
    toolIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const defaults = getDefaultMasterAgentConfig();
  const updates: {
    name?: string;
    systemPrompt?: string;
    model?: string | null;
    maxSteps?: number;
    thinkingEnabled?: boolean;
    toolIds?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (body.name !== undefined) {
    updates.name =
      typeof body.name === "string" && body.name.trim() ? body.name.trim() : row.name;
  }
  if (body.systemPrompt !== undefined) {
    updates.systemPrompt =
      typeof body.systemPrompt === "string" && body.systemPrompt.trim()
        ? body.systemPrompt.trim()
        : defaults.systemPrompt;
  }
  if (body.model !== undefined) {
    updates.model =
      body.model != null && typeof body.model === "string" && body.model.trim()
        ? body.model.trim()
        : null;
  }
  if (body.maxSteps !== undefined) {
    const n = typeof body.maxSteps === "number" ? body.maxSteps : Number(body.maxSteps);
    updates.maxSteps = Number.isFinite(n) && n >= 1 && n <= 100 ? n : defaults.maxSteps;
  }
  if (body.thinkingEnabled !== undefined) {
    updates.thinkingEnabled = Boolean(body.thinkingEnabled);
  }
  if (body.toolIds !== undefined) {
    const list = Array.isArray(body.toolIds) ? body.toolIds.filter((t): t is string => typeof t === "string") : [];
    updates.toolIds = list.length > 0 ? JSON.stringify(list) : null;
  }

  const { updatedAt, ...rest } = updates;
  await db
    .update(masterAgents)
    .set({ ...rest, updatedAt })
    .where(and(eq(masterAgents.id, id), eq(masterAgents.userId, userId)));

  const updated = await db.query.masterAgents.findFirst({
    where: eq(masterAgents.id, id),
  });
  if (!updated) {
    return NextResponse.json({ error: "Master agent not found" }, { status: 404 });
  }
  const toolIds: string[] = (() => {
    if (!updated.toolIds || typeof updated.toolIds !== "string") return [];
    try {
      const arr = JSON.parse(updated.toolIds);
      return Array.isArray(arr) ? arr.filter((id: unknown): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  })();
  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    systemPrompt: updated.systemPrompt,
    model: updated.model,
    maxSteps: updated.maxSteps,
    thinkingEnabled: updated.thinkingEnabled,
    toolIds,
    updatedAt: updated.updatedAt?.toISOString?.() ?? updated.updatedAt,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await ensureDefaultUser();
  const row = await db.query.masterAgents.findFirst({
    where: and(eq(masterAgents.id, id), eq(masterAgents.userId, userId)),
  });
  if (!row) {
    return NextResponse.json({ error: "Master agent not found" }, { status: 404 });
  }

  await db
    .update(conversations)
    .set({ masterAgentId: null })
    .where(eq(conversations.masterAgentId, id));

  await db
    .delete(masterAgents)
    .where(and(eq(masterAgents.id, id), eq(masterAgents.userId, userId)));
  return new NextResponse(null, { status: 204 });
}
