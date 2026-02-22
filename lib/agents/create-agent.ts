import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agents, agentTools, masterAgents } from "@/lib/db/schema";
import { getDefaultMasterAgentConfig } from "@/lib/db/master-agents";

export type CreateMasterBody = {
  name?: string;
  systemPrompt?: string;
  model?: string | null;
  maxSteps?: number | null;
  thinkingEnabled?: boolean | null;
  toolIds?: string[];
};

export type CreateSubagentBody = {
  name: string;
  systemPrompt: string;
  model?: string | null;
  knowledge?: string | null;
  maxSteps?: number | null;
  thinkingEnabled?: boolean | null;
  toolIds?: string[];
};

export type CreatedMasterAgent = {
  id: string;
  name: string;
  systemPrompt: string;
  model: string | null;
  maxSteps: number | null;
  thinkingEnabled: boolean | null;
  toolIds: string[];
  updatedAt: string | null;
};

export type CreatedSubagent = {
  id: string;
  name: string;
  systemPrompt: string;
  model: string | null;
  knowledge: string | null;
  maxSteps: number | null;
  thinkingEnabled: boolean | null;
  toolIds: string[];
  createdAt: string | null;
};

function parseMaxStepsSubagent(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 50 ? n : null;
}

function parseMaxStepsMaster(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 100 ? n : null;
}

function parseToolIds(raw: string | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((id: unknown): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function createMasterAgent(
  userId: string,
  body: CreateMasterBody
): Promise<CreatedMasterAgent> {
  const defaults = getDefaultMasterAgentConfig();
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "Default";
  const systemPrompt =
    typeof body.systemPrompt === "string" && body.systemPrompt.trim()
      ? body.systemPrompt.trim()
      : defaults.systemPrompt;
  const model =
    body.model != null && typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : null;
  const maxSteps = parseMaxStepsMaster(body.maxSteps) ?? defaults.maxSteps;
  const thinkingEnabled =
    body.thinkingEnabled !== undefined ? Boolean(body.thinkingEnabled) : defaults.thinkingEnabled;
  const toolIds =
    Array.isArray(body.toolIds) && body.toolIds.length > 0
      ? JSON.stringify(body.toolIds.filter((t): t is string => typeof t === "string"))
      : null;

  const id = randomUUID();
  const now = new Date();
  await db.insert(masterAgents).values({
    id,
    userId,
    name,
    systemPrompt,
    model,
    maxSteps,
    thinkingEnabled,
    toolIds,
    updatedAt: now,
  });

  const row = await db.query.masterAgents.findFirst({
    where: eq(masterAgents.id, id),
  });
  if (!row) {
    throw new Error("Failed to create master agent");
  }
  return {
    id: row.id,
    name: row.name,
    systemPrompt: row.systemPrompt,
    model: row.model,
    maxSteps: row.maxSteps,
    thinkingEnabled: row.thinkingEnabled,
    toolIds: parseToolIds(row.toolIds),
    updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as unknown as string) ?? null,
  };
}

export async function createSubagent(
  userId: string,
  body: CreateSubagentBody
): Promise<CreatedSubagent> {
  const name = body.name.trim();
  const systemPrompt = body.systemPrompt.trim();
  if (!name) {
    throw new Error("name is required");
  }
  if (!systemPrompt) {
    throw new Error("systemPrompt is required");
  }

  const model = body.model != null && typeof body.model === "string" ? body.model.trim() : null;
  const knowledge =
    body.knowledge != null && typeof body.knowledge === "string"
      ? body.knowledge.trim() || null
      : null;
  const maxSteps = parseMaxStepsSubagent(body.maxSteps);
  const thinkingEnabled =
    body.thinkingEnabled !== undefined ? Boolean(body.thinkingEnabled) : null;
  const toolIdList = Array.isArray(body.toolIds)
    ? body.toolIds.filter((t): t is string => typeof t === "string")
    : [];

  const id = randomUUID();
  await db.insert(agents).values({
    id,
    userId,
    name,
    systemPrompt,
    model,
    knowledge,
    maxSteps,
    thinkingEnabled,
    createdAt: new Date(),
  });

  if (toolIdList.length > 0) {
    await db.insert(agentTools).values(
      toolIdList.map((toolId) => ({ agentId: id, toolId }))
    );
  }

  const row = await db.query.agents.findFirst({
    where: eq(agents.id, id),
  });
  if (!row) {
    throw new Error("Failed to create subagent");
  }
  const assignedToolRows = await db.query.agentTools.findMany({
    where: eq(agentTools.agentId, id),
    columns: { toolId: true },
  });
  return {
    id: row.id,
    name: row.name,
    systemPrompt: row.systemPrompt,
    model: row.model,
    knowledge: row.knowledge,
    maxSteps: row.maxSteps,
    thinkingEnabled: row.thinkingEnabled,
    toolIds: assignedToolRows.map((r) => r.toolId),
    createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as unknown as string) ?? null,
  };
}
