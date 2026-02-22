import { NextRequest, NextResponse } from "next/server";
import { streamText, stepCountIs, convertToModelMessages, type ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/lib/db";
import { agents, agentTools } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";
import { buildKnowledgeBlock } from "@/lib/db/knowledge";
import { buildToolSetFromToolIds } from "@/lib/agents/configured-tools";
import { log } from "@/lib/logger";
import type { UIMessage } from "ai";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const MAX_CONTEXT_MESSAGES = 50;

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const userId = getDefaultUserId();

  let body: { message?: string; messages?: UIMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const uiMessages = Array.isArray(body.messages) ? body.messages : null;
  const messageText =
    typeof body.message === "string"
      ? body.message.trim()
      : uiMessages && uiMessages.length > 0
        ? (() => {
            const last = uiMessages[uiMessages.length - 1];
            if (last?.role !== "user") return null;
            const parts = "parts" in last && Array.isArray(last.parts) ? last.parts : [];
            return parts.map((p: { type?: string; text?: string }) => (p.type === "text" ? p.text ?? "" : "")).join("").trim() || null;
          })()
        : null;
  if (!messageText) {
    return NextResponse.json({ error: "message or messages required" }, { status: 400 });
  }

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.userId, userId)),
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const assignedToolRows = await db.query.agentTools.findMany({
    where: eq(agentTools.agentId, agentId),
    columns: { toolId: true },
  });
  const toolIds = assignedToolRows.map((r) => r.toolId);
  const tools = await buildToolSetFromToolIds(userId, toolIds);
  const hasTools = Object.keys(tools).length > 0;

  const modelId = agent.model ?? DEFAULT_GEMINI_MODEL;
  const model = google(modelId);
  const knowledgeBlock = await buildKnowledgeBlock(userId, "agent", agentId, {
    agentLegacyKnowledge: agent.knowledge,
  });
  const structuredHint = hasTools
    ? ""
    : "\n\nOptional: you may end your response with a single JSON line of the form {\"summary\":\"brief answer\",\"detail\":\"full answer\"}.";
  const systemContent =
    agent.systemPrompt + (knowledgeBlock ? knowledgeBlock : "") + structuredHint;

  const providerOptions =
    agent.thinkingEnabled === true
      ? { google: { thinkingConfig: { includeThoughts: true } as const } }
      : undefined;
  const maxSteps = Math.max(2, agent.maxSteps ?? 5);

  const agentLog = log.child({ agentId, context: "test_chat" });
  agentLog.info("test_chat.start", { messageLength: messageText.length });

  let modelMessages: ModelMessage[];
  if (uiMessages && uiMessages.length > 0) {
    const converted = await convertToModelMessages(uiMessages);
    modelMessages = converted.slice(-MAX_CONTEXT_MESSAGES);
  } else {
    modelMessages = [{ role: "user", content: messageText }];
  }

  try {
    const result = streamText({
      model,
      system: systemContent,
      messages: modelMessages,
      ...(hasTools && { tools }),
      ...(hasTools && { stopWhen: stepCountIs(maxSteps) }),
      ...(providerOptions && { providerOptions }),
    });
    return result.toUIMessageStreamResponse();
  } catch (err) {
    agentLog.error("test_chat.error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
