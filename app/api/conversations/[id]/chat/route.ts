import { NextRequest, NextResponse } from "next/server";
import { streamText, convertToModelMessages, stepCountIs, type ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { createMasterTools } from "@/lib/agents/master-tools";
import { createBuilderTools, BUILDER_SYSTEM_PROMPT } from "@/lib/agents/builder-tools";
import { getBuilderConfig } from "@/lib/db/builder-config";
import { buildToolSetFromToolIds } from "@/lib/agents/configured-tools";
import { db } from "@/lib/db";
import { conversations, messages, agents, workingDocs } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";
import { getConfigForConversation } from "@/lib/db/master-agents";
import { getMemoriesForMasterAgent } from "@/lib/db/master-agent-memories";
import { suggestAgentForRequest } from "@/lib/agents/suggest-agent";
import { buildKnowledgeBlock } from "@/lib/db/knowledge";
import { getDocByConversationId } from "@/lib/db/doc";
import { setDocLock } from "@/lib/db/doc";
import { randomUUID } from "crypto";
import type { UIMessage } from "ai";
import { log } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const userId = getDefaultUserId();

  const conv = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.userId, userId)
    ),
  });
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  let body: { message?: string; messages?: UIMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const uiMessages = Array.isArray(body.messages) ? body.messages : null;
  const userMessageText =
    typeof body.message === "string"
      ? body.message
      : uiMessages && uiMessages.length > 0
        ? (() => {
            const last = uiMessages[uiMessages.length - 1];
            if (last?.role !== "user") return null;
            const parts = "parts" in last && Array.isArray(last.parts) ? last.parts : [];
            return parts.map((p: { type?: string; text?: string }) => (p.type === "text" ? p.text ?? "" : "")).join("").trim() || null;
          })()
        : null;

  if (!userMessageText) {
    return NextResponse.json({ error: "message or messages required" }, { status: 400 });
  }

  const chatLog = log.child({ conversationId });
  chatLog.info("chat.request", { userId, messageLength: userMessageText.length });

  try {
    const MAX_CONTEXT_MESSAGES = 100;
    let modelMessages: ModelMessage[];
    if (uiMessages && uiMessages.length > 0) {
      const converted = await convertToModelMessages(uiMessages);
      modelMessages = converted.slice(-MAX_CONTEXT_MESSAGES);
    } else {
      const dbMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        columns: { role: true, content: true },
        orderBy: (m, { asc }) => [asc(m.createdAt)],
      });
      const history = dbMessages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));
      const withNew = [...history, { role: "user" as const, content: userMessageText }];
      modelMessages = withNew.slice(-MAX_CONTEXT_MESSAGES) as ModelMessage[];
    }

    const isBuilder = Boolean(conv.isBuilder);

    if (isBuilder) {
      const builderCfg = await getBuilderConfig(userId);
      const systemPrompt = (builderCfg?.systemPrompt?.trim() || BUILDER_SYSTEM_PROMPT);
      const modelId = builderCfg?.model?.trim() || "gemini-2.5-flash";
      const maxSteps = builderCfg?.maxSteps ?? 15;
      const thinkingEnabled = builderCfg?.thinkingEnabled ?? false;
      const tools = createBuilderTools();
      const model = google(modelId);
      const userMsgId = randomUUID();
      await db.insert(messages).values({
        id: userMsgId,
        conversationId,
        role: "user",
        content: userMessageText,
        createdAt: new Date(),
      });
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
      chatLog.info("chat.stream_start", { builder: true, modelId, maxSteps });
      const result = streamText({
        model,
        system: systemPrompt,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(maxSteps),
        ...(thinkingEnabled && {
          providerOptions: { google: { thinkingConfig: { includeThoughts: true } as const } },
        }),
        experimental_onToolCallStart: ({ toolCall }) => {
          const name = "toolName" in toolCall ? String(toolCall.toolName) : "unknown";
          chatLog.info("tool_call.start", { toolName: name });
        },
        experimental_onToolCallFinish: ({ toolCall, durationMs, success, error }) => {
          const name = "toolName" in toolCall ? String(toolCall.toolName) : "unknown";
          if (success) chatLog.info("tool_call.finish", { toolName: name, durationMs });
          else chatLog.warn("tool_call.finish", { toolName: name, durationMs, error: error instanceof Error ? error.message : String(error) });
        },
        onFinish: async ({ text }) => {
          try {
            const assistantMsgId = randomUUID();
            await db.insert(messages).values({
              id: assistantMsgId,
              conversationId,
              role: "assistant",
              content: text,
              createdAt: new Date(),
            });
            await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
            chatLog.info("chat.finish", { textLength: text?.length ?? 0 });
          } catch (finishErr) {
            chatLog.error("chat.finish_error", { error: finishErr instanceof Error ? finishErr.message : String(finishErr) });
            throw finishErr;
          }
        },
      });
      return result.toUIMessageStreamResponse();
    }

    let docRow = await getDocByConversationId(conversationId);
    if (!docRow) {
      const docId = randomUUID();
      await db.insert(workingDocs).values({
        id: docId,
        conversationId,
        content: "",
        updatedAt: new Date(),
      });
      docRow = await getDocByConversationId(conversationId);
    }
    const docContent = docRow?.content ?? "";
    await setDocLock(conversationId, "agent");

    const masterCfg = await getConfigForConversation(conversationId);
    const masterAgentId = masterCfg.id || null;
    const agentList =
      masterAgentId && masterCfg.subAgentIds && masterCfg.subAgentIds.length > 0
        ? await db.query.agents.findMany({
            where: and(eq(agents.userId, userId), inArray(agents.id, masterCfg.subAgentIds)),
            columns: { id: true, name: true, systemPrompt: true },
          })
        : await db.query.agents.findMany({
            where: eq(agents.userId, userId),
            columns: { id: true, name: true, systemPrompt: true },
          });
    const oneLineDescription = (prompt: string | null) => {
      if (!prompt || !prompt.trim()) return "";
      const firstLine = prompt.trim().split(/\n/)[0]?.trim() ?? "";
      return firstLine.length > 120 ? firstLine.slice(0, 117) + "…" : firstLine;
    };
    const agentListText =
      agentList.length > 0
        ? `User-created agents (use invoke_agent with these IDs when the user's task matches the agent's expertise):\n${agentList.map((a) => `- ${a.name} (${a.id})${oneLineDescription(a.systemPrompt) ? ": " + oneLineDescription(a.systemPrompt) : ""}`).join("\n")}`
        : "No user-created agents yet.";

    chatLog.info("chat.config", {
      masterAgentId,
      modelId: masterCfg.model ?? "gemini-2.5-flash",
      maxSteps: masterCfg.maxSteps ?? 10,
      thinkingEnabled: masterCfg.thinkingEnabled,
      configuredToolIds: masterCfg.toolIds ?? [],
    });

    const [longTermMemories, suggestedAgent] = await Promise.all([
      getMemoriesForMasterAgent(masterAgentId, { limit: 50 }),
      agentList.length > 0
        ? suggestAgentForRequest(userMessageText, agentList.map((a) => ({ id: a.id, name: a.name, description: oneLineDescription(a.systemPrompt) })))
        : Promise.resolve(null),
    ]);
    const builtInTools = createMasterTools(conversationId, masterAgentId);
    const configuredToolIds = masterCfg.toolIds ?? [];
    const configuredTools = await buildToolSetFromToolIds(userId, configuredToolIds);
    const tools = { ...builtInTools, ...configuredTools };
    const toolNames = Object.keys(tools);
    chatLog.info("chat.tools_built", { toolNames });

    const modelId = masterCfg.model ?? "gemini-2.5-flash";
    const model = google(modelId);

    const knowledgeBlock =
      masterAgentId
        ? await buildKnowledgeBlock(userId, "master", masterAgentId)
        : "";
    const researchHint =
      knowledgeBlock || masterAgentId
        ? "\n\nUse the research tool for file-backed context; files are scoped to this master."
        : "";
    const memoriesSection =
      longTermMemories.length > 0
        ? `\n\nLong-term memories (use for context across conversations):\n${longTermMemories.map((m) => `- ${m.content}`).join("\n")}`
        : "";
    const suggestedHint =
      suggestedAgent != null
        ? `\n\nSuggested specialist for this request: ${suggestedAgent.agentName} (${suggestedAgent.agentId}). You may still choose a different agent or none.`
        : "";
    const systemPrompt = `${masterCfg.systemPrompt}\n\n${agentListText}${suggestedHint}\n\nCurrent working doc content (user and agents share this):\n---\n${docContent}\n---${knowledgeBlock}${researchHint}${memoriesSection}`;

    const providerOptions = masterCfg.thinkingEnabled
      ? { google: { thinkingConfig: { includeThoughts: true } as const } }
      : undefined;

    const userMsgId = randomUUID();
    await db.insert(messages).values({
      id: userMsgId,
      conversationId,
      role: "user",
      content: userMessageText,
      createdAt: new Date(),
    });
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    chatLog.info("chat.stream_start");

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(masterCfg.maxSteps ?? 10),
      ...(providerOptions && { providerOptions }),
      experimental_onToolCallStart: ({ toolCall }) => {
        const name = "toolName" in toolCall ? String(toolCall.toolName) : "unknown";
        chatLog.info("tool_call.start", { toolName: name });
      },
      experimental_onToolCallFinish: ({ toolCall, durationMs, success, error }) => {
        const name = "toolName" in toolCall ? String(toolCall.toolName) : "unknown";
        if (success) {
          chatLog.info("tool_call.finish", { toolName: name, durationMs });
        } else {
          chatLog.warn("tool_call.finish", {
            toolName: name,
            durationMs,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      onFinish: async ({ text }) => {
        await setDocLock(conversationId, null);
        try {
          const assistantMsgId = randomUUID();
          await db.insert(messages).values({
            id: assistantMsgId,
            conversationId,
            role: "assistant",
            content: text,
            createdAt: new Date(),
          });
          await db
            .update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, conversationId));
          chatLog.info("chat.finish", { textLength: text?.length ?? 0 });
        } catch (finishErr) {
          chatLog.error("chat.finish_error", {
            error: finishErr instanceof Error ? finishErr.message : String(finishErr),
          });
          throw finishErr;
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    log.error("chat.error", {
      conversationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
