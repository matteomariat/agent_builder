import { NextRequest, NextResponse } from "next/server";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { createMasterTools, MASTER_SYSTEM_PROMPT } from "@/lib/agents/master-tools";
import { db } from "@/lib/db";
import { conversations, messages, agents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";
import { getDocByConversationId } from "@/lib/db/doc";
import { setDocLock } from "@/lib/db/doc";
import { randomUUID } from "crypto";
import type { UIMessage } from "ai";

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

  const modelMessages = uiMessages ? await convertToModelMessages(uiMessages) : [{ role: "user" as const, content: userMessageText }];

  const docRow = await getDocByConversationId(conversationId);
  const docContent = docRow?.content ?? "";
  const agentList = await db.query.agents.findMany({
    where: eq(agents.userId, userId),
    columns: { id: true, name: true },
  });
  const agentListText =
    agentList.length > 0
      ? `User-created agents (use invoke_agent with these IDs):\n${agentList.map((a) => `- ${a.name}: ${a.id}`).join("\n")}`
      : "No user-created agents yet.";

  await setDocLock(conversationId, "agent");

  const tools = createMasterTools(conversationId);
  const model = google("gemini-2.5-flash");

  const systemPrompt = `${MASTER_SYSTEM_PROMPT}\n\n${agentListText}\n\nCurrent working doc content (user and agents share this):\n---\n${docContent}\n---`;

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

  const result = streamText({
    model,
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(10),
    onFinish: async ({ text }) => {
      await setDocLock(conversationId, null);
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
    },
  });

  return result.toUIMessageStreamResponse();
}
