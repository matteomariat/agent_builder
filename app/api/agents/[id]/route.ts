import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, agentTools } from "@/lib/db/schema";
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
  const assignedToolRows = await db.query.agentTools.findMany({
    where: eq(agentTools.agentId, id),
    columns: { toolId: true },
  });
  return NextResponse.json({
    ...row,
    toolIds: assignedToolRows.map((r) => r.toolId),
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getDefaultUserId();
  let body: {
    name?: string;
    systemPrompt?: string;
    model?: string | null;
    knowledge?: string | null;
    maxSteps?: number | null;
    thinkingEnabled?: boolean | null;
    toolIds?: string[];
  };
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
  const updates: {
    name?: string;
    systemPrompt?: string;
    model?: string | null;
    knowledge?: string | null;
    maxSteps?: number | null;
    thinkingEnabled?: boolean | null;
  } = {};
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
    updates.model = body.model != null && typeof body.model === "string" ? body.model.trim() : null;
  }
  if (body.knowledge !== undefined) {
    updates.knowledge =
      body.knowledge != null && typeof body.knowledge === "string"
        ? body.knowledge.trim() || null
        : null;
  }
  if (body.maxSteps !== undefined) {
    const n = typeof body.maxSteps === "number" ? body.maxSteps : Number(body.maxSteps);
    updates.maxSteps = Number.isFinite(n) && n >= 1 && n <= 50 ? n : null;
  }
  if (body.thinkingEnabled !== undefined) {
    updates.thinkingEnabled = Boolean(body.thinkingEnabled);
  }
  const toolIdList =
    body.toolIds !== undefined
      ? (Array.isArray(body.toolIds) ? body.toolIds : []).filter((t): t is string => typeof t === "string")
      : null;
  if (Object.keys(updates).length === 0 && toolIdList === null) {
    const assignedToolRows = await db.query.agentTools.findMany({
      where: eq(agentTools.agentId, id),
      columns: { toolId: true },
    });
    return NextResponse.json({
      ...existing,
      toolIds: assignedToolRows.map((r) => r.toolId),
      createdAt: existing.createdAt?.toISOString?.() ?? existing.createdAt,
    });
  }
  if (Object.keys(updates).length > 0) {
    await db
      .update(agents)
      .set(updates)
      .where(and(eq(agents.id, id), eq(agents.userId, userId)));
  }
  if (toolIdList !== null) {
    await db.delete(agentTools).where(eq(agentTools.agentId, id));
    if (toolIdList.length > 0) {
      await db.insert(agentTools).values(
        toolIdList.map((toolId) => ({ agentId: id, toolId }))
      );
    }
  }
  const row = await db.query.agents.findFirst({
    where: eq(agents.id, id),
  });
  const assignedToolRows = await db.query.agentTools.findMany({
    where: eq(agentTools.agentId, id),
    columns: { toolId: true },
  });
  return NextResponse.json({
    ...row,
    toolIds: assignedToolRows.map((r) => r.toolId),
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
