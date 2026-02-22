import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, agentTools } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { ensureDefaultUser } from "@/lib/db/users";
import { createSubagent } from "@/lib/agents/create-agent";

export async function GET() {
  const userId = await ensureDefaultUser();
  const list = await db.query.agents.findMany({
    where: eq(agents.userId, userId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
  const agentIds = list.map((a) => a.id);
  const allAssignments =
    agentIds.length > 0
      ? await db.query.agentTools.findMany({
          where: inArray(agentTools.agentId, agentIds),
          columns: { agentId: true, toolId: true },
        })
      : [];
  const toolIdsByAgent = new Map<string, string[]>();
  for (const { agentId, toolId } of allAssignments) {
    const arr = toolIdsByAgent.get(agentId) ?? [];
    arr.push(toolId);
    toolIdsByAgent.set(agentId, arr);
  }
  return NextResponse.json(
    list.map((a) => ({
      ...a,
      toolIds: toolIdsByAgent.get(a.id) ?? [],
      createdAt: a.createdAt?.toISOString?.() ?? a.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const userId = await ensureDefaultUser();
  let body: {
    name?: string;
    systemPrompt?: string;
    model?: string;
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
  const { name, systemPrompt } = body;
  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }
  if (!systemPrompt || typeof systemPrompt !== "string") {
    return NextResponse.json(
      { error: "systemPrompt is required" },
      { status: 400 }
    );
  }
  try {
    const created = await createSubagent(userId, {
      name,
      systemPrompt,
      model: body.model,
      knowledge: body.knowledge,
      maxSteps: body.maxSteps,
      thinkingEnabled: body.thinkingEnabled,
      toolIds: body.toolIds,
    });
    return NextResponse.json(created);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create agent";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
