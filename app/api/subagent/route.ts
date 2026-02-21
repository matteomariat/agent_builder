import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { buildSubagentSystemPrompt } from "@/lib/ai/master-agent";

interface FileData {
  id: string;
  name: string;
  type: string;
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { agentConfig, task, context, files, documentContent } =
      await req.json();

    const documentWrites: { content: string; mode: string }[] = [];
    let currentDocContent = documentContent ?? "";

    const system = buildSubagentSystemPrompt(agentConfig, task, context);

    const result = await generateText({
      model: google(agentConfig.modelId ?? "gemini-2.0-flash"),
      system,
      prompt: task,
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
            documentWrites.push({ content, mode });
            if (mode === "replace") {
              currentDocContent = content;
            } else {
              currentDocContent = currentDocContent + content;
            }
            return { success: true };
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
            const file = (files as FileData[])?.find(
              (f) => f.name === filename
            );
            if (!file) return { error: `File "${filename}" not found` };
            const preview = file.content.slice(0, 8000);
            return { content: preview };
          },
        }),
      },
      stopWhen: stepCountIs(8),
    });

    return NextResponse.json({
      result: result.text,
      documentWrites,
    });
  } catch (err) {
    console.error("Subagent error:", err);
    return NextResponse.json(
      { error: "Subagent failed", result: "", documentWrites: [] },
      { status: 500 }
    );
  }
}
