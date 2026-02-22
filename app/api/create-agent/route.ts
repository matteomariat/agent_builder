import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultUser } from "@/lib/db/users";
import { createMasterAgent, createSubagent } from "@/lib/agents/create-agent";

type CreateAgentBody = {
  type?: "master" | "subagent";
  name?: string;
  systemPrompt?: string;
  model?: string | null;
  maxSteps?: number | null;
  thinkingEnabled?: boolean | null;
  toolIds?: string[];
  knowledge?: string | null;
};

export async function POST(request: NextRequest) {
  const userId = await ensureDefaultUser();
  let body: CreateAgentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type;
  if (type !== "master" && type !== "subagent") {
    return NextResponse.json(
      { error: "type is required and must be 'master' or 'subagent'" },
      { status: 400 }
    );
  }

  if (type === "master") {
    try {
      const created = await createMasterAgent(userId, {
        name: body.name,
        systemPrompt: body.systemPrompt,
        model: body.model,
        maxSteps: body.maxSteps,
        thinkingEnabled: body.thinkingEnabled,
        toolIds: body.toolIds,
      });
      return NextResponse.json(created, { status: 201 });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create master agent";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.systemPrompt || typeof body.systemPrompt !== "string") {
    return NextResponse.json({ error: "systemPrompt is required" }, { status: 400 });
  }

  try {
    const created = await createSubagent(userId, {
      name: body.name,
      systemPrompt: body.systemPrompt,
      model: body.model,
      knowledge: body.knowledge,
      maxSteps: body.maxSteps,
      thinkingEnabled: body.thinkingEnabled,
      toolIds: body.toolIds,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create subagent";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
