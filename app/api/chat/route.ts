import { NextRequest } from "next/server";
import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from "ai";
import { z } from "zod";
import { buildMasterSystemPrompt } from "@/lib/ai/master-agent";

export const maxDuration = 60;

interface FileData {
  id: string;
  name: string;
  type: string;
  content: string;
}

interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  modelId: string;
  isMaster: boolean;
}

export async function POST(req: NextRequest) {
  const {
    messages,
    masterAgent,
    agents,
    files,
    documentContent,
  }: {
    messages: UIMessage[];
    masterAgent: AgentConfig | null;
    agents: AgentConfig[];
    files: FileData[];
    documentContent: string;
  } = await req.json();

  if (!masterAgent) {
    return new Response("No master agent configured", { status: 400 });
  }

  let currentDocContent = documentContent ?? "";

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: google(masterAgent.modelId ?? "gemini-2.0-flash"),
        system: buildMasterSystemPrompt(masterAgent, agents ?? [], files ?? []),
        messages: await convertToModelMessages(messages),
        stopWhen: stepCountIs(15),
        tools: {
          writeToDocument: tool({
            description:
              "Write or append content to the shared working document.",
            inputSchema: z.object({
              content: z.string().describe("The content to write"),
              mode: z
                .enum(["replace", "append"])
                .describe("Whether to replace the document or append to it"),
            }),
            execute: async ({ content, mode }) => {
              if (mode === "replace") {
                currentDocContent = content;
              } else {
                currentDocContent = currentDocContent + content;
              }

              writer.write({
                type: "data-document_write",
                id: `doc-${Date.now()}`,
                data: { content, mode },
                transient: true,
              });

              return { success: true, mode };
            },
          }),

          readDocument: tool({
            description: "Read the current content of the working document.",
            inputSchema: z.object({}),
            execute: async () => ({
              content: currentDocContent,
            }),
          }),

          readFile: tool({
            description: "Read the content of an uploaded file by name.",
            inputSchema: z.object({
              filename: z.string().describe("The name of the file to read"),
            }),
            execute: async ({ filename }) => {
              const file = (files ?? []).find((f) => f.name === filename);
              if (!file) return { error: `File "${filename}" not found` };
              // Return first 8000 chars to stay within context
              return { content: file.content.slice(0, 8000) };
            },
          }),

          spawnSubagent: tool({
            description:
              "Delegate a specific task to a subagent. Use this when a specialized subtask should be handled by a configured subagent.",
            inputSchema: z.object({
              agentId: z
                .string()
                .describe("The ID of the subagent to use"),
              task: z
                .string()
                .describe("A clear description of the task for the subagent"),
              context: z
                .string()
                .optional()
                .describe("Additional context or data to provide to the subagent"),
            }),
            execute: async ({ agentId, task, context }) => {
              const agentConfig = (agents ?? []).find((a) => a.id === agentId);
              if (!agentConfig) {
                return { error: `Subagent "${agentId}" not found` };
              }

              const taskId = crypto.randomUUID();

              // Notify client that subagent started
              writer.write({
                type: "data-subagent_start",
                id: `sa-start-${taskId}`,
                data: {
                  taskId,
                  agentId,
                  agentName: agentConfig.name,
                  task,
                },
                transient: true,
              });

              try {
                // Call subagent endpoint
                const origin = req.headers.get("origin") ?? "http://localhost:3000";
                const subagentRes = await fetch(
                  `${origin}/api/subagent`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      agentConfig,
                      task,
                      context,
                      files,
                      documentContent: currentDocContent,
                    }),
                  }
                );

                const subagentData = await subagentRes.json();

                // Apply subagent document writes
                if (
                  subagentData.documentWrites &&
                  subagentData.documentWrites.length > 0
                ) {
                  for (const write of subagentData.documentWrites) {
                    if (write.mode === "replace") {
                      currentDocContent = write.content;
                    } else {
                      currentDocContent = currentDocContent + write.content;
                    }

                    writer.write({
                      type: "data-document_write",
                      id: `doc-${Date.now()}`,
                      data: { content: write.content, mode: write.mode },
                      transient: true,
                    });
                  }
                }

                // Notify client that subagent completed
                writer.write({
                  type: "data-subagent_done",
                  id: `sa-done-${taskId}`,
                  data: { taskId, result: subagentData.result ?? "" },
                  transient: true,
                });

                return {
                  success: true,
                  result: subagentData.result,
                  agent: agentConfig.name,
                };
              } catch (err) {
                writer.write({
                  type: "data-subagent_error",
                  id: `sa-err-${taskId}`,
                  data: { taskId },
                  transient: true,
                });

                return { error: "Subagent execution failed" };
              }
            },
          }),
        },
      });

      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
