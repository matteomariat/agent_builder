import { db } from "./index";
import { masterAgents, conversations } from "./schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_MAX_STEPS = 10;

const DEFAULT_SYSTEM_PROMPT =
  `You are the Master agent. You coordinate work by:
1. Delegating to user-created agents via the invoke_agent tool (pass agentId and message).
2. Writing to the shared working doc via write_to_doc (append or replace). Only write when the user is not editing.
3. Using the research tool to search/summarize the user's uploaded files.

Always be helpful and concise. When you delegate to another agent, summarize their result for the user. When you write to the doc, use clear structure (headings, lists).

After receiving a sub-agent's result, always respond to the user with a clear, formatted answer (use the working doc for long content). Do not forward raw tool output; synthesize and attribute briefly if useful (e.g. "Based on the research agent: …"). When a sub-agent returns summary and detail, you may use summary for a brief reply and detail for the full answer.`;

export type MasterAgentConfig = {
  id: string;
  name: string;
  systemPrompt: string;
  model: string | null;
  maxSteps: number;
  thinkingEnabled: boolean;
  toolIds: string[] | null;
  updatedAt: string | null;
};

export function getDefaultMasterAgentConfig(): Omit<MasterAgentConfig, "id" | "name" | "updatedAt"> & { updatedAt: null } {
  return {
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    model: DEFAULT_MODEL,
    maxSteps: DEFAULT_MAX_STEPS,
    thinkingEnabled: false,
    toolIds: null,
    updatedAt: null,
  };
}

export async function getMasterAgentById(id: string) {
  return db.query.masterAgents.findFirst({
    where: eq(masterAgents.id, id),
  });
}

export async function getMasterAgentsByUserId(userId: string) {
  return db.query.masterAgents.findMany({
    where: eq(masterAgents.userId, userId),
    orderBy: (ma, { asc }) => [asc(ma.name)],
  });
}

export async function getConfigForConversation(conversationId: string): Promise<MasterAgentConfig> {
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    columns: { masterAgentId: true, userId: true },
  });
  if (!conv) {
    const defaults = getDefaultMasterAgentConfig();
    return {
      id: "",
      name: "Default",
      systemPrompt: defaults.systemPrompt,
      model: defaults.model,
      maxSteps: defaults.maxSteps,
      thinkingEnabled: defaults.thinkingEnabled,
      toolIds: null,
      updatedAt: null,
    };
  }
  const parseToolIds = (raw: string | null): string[] => {
    if (!raw || typeof raw !== "string") return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((id: unknown): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  };
  if (conv.masterAgentId) {
    const row = await getMasterAgentById(conv.masterAgentId);
    if (row) {
      return {
        id: row.id,
        name: row.name,
        systemPrompt: row.systemPrompt,
        model: row.model ?? DEFAULT_MODEL,
        maxSteps: row.maxSteps ?? DEFAULT_MAX_STEPS,
        thinkingEnabled: row.thinkingEnabled ?? false,
        toolIds: parseToolIds(row.toolIds),
        updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as unknown as string) ?? null,
      };
    }
  }
  const firstForUser = await db.query.masterAgents.findFirst({
    where: eq(masterAgents.userId, conv.userId),
    orderBy: (ma, { asc }) => [asc(ma.name)],
  });
  if (firstForUser) {
    return {
      id: firstForUser.id,
      name: firstForUser.name,
      systemPrompt: firstForUser.systemPrompt,
      model: firstForUser.model ?? DEFAULT_MODEL,
      maxSteps: firstForUser.maxSteps ?? DEFAULT_MAX_STEPS,
      thinkingEnabled: firstForUser.thinkingEnabled ?? false,
      toolIds: parseToolIds(firstForUser.toolIds),
      updatedAt: firstForUser.updatedAt?.toISOString?.() ?? (firstForUser.updatedAt as unknown as string) ?? null,
    };
  }
  const defaults = getDefaultMasterAgentConfig();
  return {
    id: "",
    name: "Default",
    systemPrompt: defaults.systemPrompt,
    model: defaults.model,
    maxSteps: defaults.maxSteps,
    thinkingEnabled: defaults.thinkingEnabled,
    toolIds: null,
    updatedAt: null,
  };
}
