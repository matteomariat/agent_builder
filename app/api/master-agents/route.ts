import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultUser } from "@/lib/db/users";
import { getMasterAgentsByUserId } from "@/lib/db/master-agents";
import { createMasterAgent } from "@/lib/agents/create-agent";

function parseToolIds(raw: string | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((id: unknown): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const userId = await ensureDefaultUser();
  const list = await getMasterAgentsByUserId(userId);
  return NextResponse.json(
    list.map((ma) => ({
      id: ma.id,
      name: ma.name,
      systemPrompt: ma.systemPrompt,
      model: ma.model,
      maxSteps: ma.maxSteps,
      thinkingEnabled: ma.thinkingEnabled,
      toolIds: parseToolIds(ma.toolIds),
      updatedAt: ma.updatedAt?.toISOString?.() ?? ma.updatedAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const userId = await ensureDefaultUser();
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
  try {
    const created = await createMasterAgent(userId, body);
    return NextResponse.json(created);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create master agent";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
