import { tool, zodSchema } from "ai";
import { z } from "zod";
import { runUserAgent } from "./run-user-agent";
import { appendOrReplaceDoc } from "@/lib/db/doc";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";

export function createMasterTools(conversationId: string) {
  return {
    invoke_agent: tool({
      description:
        "Delegate a task to a user-created agent by ID. Use this when you need a specialist (e.g. researcher, writer) to handle part of the work. Pass the agent ID and the message to send.",
      inputSchema: zodSchema(
        z.object({
          agentId: z.string().describe("The ID of the user-created agent to invoke"),
          message: z.string().describe("The message or task to send to the agent"),
        })
      ),
      execute: async ({ agentId, message }) => {
        const result = await runUserAgent(agentId, message);
        return { result };
      },
    }),
    write_to_doc: tool({
      description:
        "Append or replace content in the working doc. Use 'append' to add new content at the end; use 'replace' to set the entire doc content. Only call when the user is not editing (doc is not locked by user).",
      inputSchema: zodSchema(
        z.object({
          mode: z.enum(["append", "replace"]).describe("append = add at end, replace = set full content"),
          content: z.string().describe("The text to append or the full doc content"),
        })
      ),
      execute: async ({ mode, content }) => {
        const out = await appendOrReplaceDoc(conversationId, mode, content, true);
        if (out === null) return { error: "Working doc not found" };
        if ("conflict" in out && out.conflict) {
          return { error: "Doc is being edited by the user. Try again later." };
        }
        return { ok: true, message: mode === "append" ? "Appended to doc." : "Doc replaced." };
      },
    }),
    research: tool({
      description:
        "Search or summarize the user's uploaded files. Returns text content from files (md, txt, csv, pdf) that the user has uploaded. Use this to answer questions using the user's data.",
      inputSchema: zodSchema(
        z.object({
          query: z.string().optional().describe("Optional search/summary query; if omitted, list all file summaries"),
        })
      ),
      execute: async ({ query }) => {
        const userId = getDefaultUserId();
        const list = await db.query.files.findMany({
          where: eq(files.userId, userId),
          columns: { id: true, filename: true, textContent: true },
        });
        if (list.length === 0) {
          return { files: [], message: "No uploaded files." };
        }
        const summaries = list.map((f) => ({
          id: f.id,
          filename: f.filename,
          preview: f.textContent
            ? f.textContent.slice(0, 2000) + (f.textContent.length > 2000 ? "…" : "")
            : "(no text extracted)",
        }));
        if (!query) {
          return { files: summaries, message: "List of uploaded files and their text preview." };
        }
        const lower = query.toLowerCase();
        const relevant = list.filter(
          (f) =>
            f.filename.toLowerCase().includes(lower) ||
            (f.textContent?.toLowerCase().includes(lower) ?? false)
        );
        const results = relevant.map((f) => ({
          id: f.id,
          filename: f.filename,
          content: f.textContent?.slice(0, 8000) ?? "(no text)",
        }));
        return { query, results, message: `Found ${results.length} relevant file(s).` };
      },
    }),
  };
}

export const MASTER_SYSTEM_PROMPT = `You are the Master agent. You coordinate work by:
1. Delegating to user-created agents via the invoke_agent tool (pass agentId and message).
2. Writing to the shared working doc via write_to_doc (append or replace). Only write when the user is not editing.
3. Using the research tool to search/summarize the user's uploaded files.

Always be helpful and concise. When you delegate to another agent, summarize their result for the user. When you write to the doc, use clear structure (headings, lists).`;
