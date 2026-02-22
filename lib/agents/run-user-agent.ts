import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/lib/db";
import { agents, agentTools } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";
import { buildKnowledgeBlock } from "@/lib/db/knowledge";
import { buildToolSetFromToolIds } from "./configured-tools";
import { log } from "@/lib/logger";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export type RunUserAgentResult = {
  result: string;
  summary?: string;
  detail?: string;
};

function tryParseStructuredOutput(text: string): { result: string; summary?: string; detail?: string } | null {
  const lines = text.trim().split(/\n/).filter((l) => l.trim());
  const last = lines[lines.length - 1];
  if (!last) return null;
  try {
    const parsed = JSON.parse(last) as unknown;
    if (parsed && typeof parsed === "object" && ("summary" in parsed || "detail" in parsed)) {
      const summary = typeof (parsed as { summary?: unknown }).summary === "string" ? (parsed as { summary: string }).summary : undefined;
      const detail = typeof (parsed as { detail?: unknown }).detail === "string" ? (parsed as { detail: string }).detail : undefined;
      const result = detail ?? summary ?? text;
      return { result, summary, detail };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function runUserAgent(
  agentId: string,
  message: string,
  context?: string
): Promise<RunUserAgentResult> {
  const agentLog = log.child({ agentId });
  const fullPrompt = context ? `Context: ${context.trim()}\n\nTask: ${message}` : message;
  agentLog.info("agent.run_start", { messageLength: message.length, hasContext: Boolean(context) });

  const userId = getDefaultUserId();
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.userId, userId)),
  });
  if (!agent) {
    agentLog.warn("agent.not_found");
    return { result: `Error: Agent ${agentId} not found.` };
  }
  const assignedToolRows = await db.query.agentTools.findMany({
    where: eq(agentTools.agentId, agentId),
    columns: { toolId: true },
  });
  const toolIds = assignedToolRows.map((r) => r.toolId);
  agentLog.info("agent.tools_loaded", { toolIds });

  const tools = await buildToolSetFromToolIds(userId, toolIds);
  const hasTools = Object.keys(tools).length > 0;

  const modelId = agent.model ?? DEFAULT_GEMINI_MODEL;
  const model = google(modelId);
  const knowledgeBlock = await buildKnowledgeBlock(userId, "agent", agentId, {
    agentLegacyKnowledge: agent.knowledge,
  });
  // Only add the optional summary/detail hint for agents without tools; tool-using agents (e.g. SERP research)
  // often have strict output formats (e.g. "only the list in markdown") and must not be asked to add JSON.
  const structuredHint = hasTools
    ? ""
    : "\n\nOptional: you may end your response with a single JSON line of the form {\"summary\":\"brief answer\",\"detail\":\"full answer\"} so the master can use summary for a short reply and detail for the full answer.";
  const systemContent =
    agent.systemPrompt + (knowledgeBlock ? knowledgeBlock : "") + structuredHint;
  const providerOptions =
    agent.thinkingEnabled === true
      ? { google: { thinkingConfig: { includeThoughts: true } as const } }
      : undefined;
  const maxSteps = Math.max(2, agent.maxSteps ?? 5);
  agentLog.info("agent.generate_start", { modelId, hasTools, maxSteps });

  const startMs = Date.now();
  try {
    const { text, reasoningText } = await generateText({
      model,
      system: systemContent,
      prompt: fullPrompt,
      ...(hasTools && { tools }),
      ...(hasTools && { stopWhen: stepCountIs(maxSteps) }),
      ...(providerOptions && { providerOptions }),
    });
    const durationMs = Date.now() - startMs;
    const responseText = (text || reasoningText) ?? "";
    agentLog.info("agent.generate_finish", {
      durationMs,
      responseLength: responseText.length,
    });
    const structured = responseText ? tryParseStructuredOutput(responseText) : null;
    if (structured) return structured;
    return { result: responseText };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    agentLog.error("agent.error", {
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
