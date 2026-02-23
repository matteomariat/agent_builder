import { tool, zodSchema } from "ai";
import { z } from "zod";
import { runUserAgent } from "./run-user-agent";
import {
  appendOrReplaceDoc,
  listDocsByConversationId,
  createDoc,
  updateDocTitle,
  deleteDoc,
  getDocById,
  getDefaultDocForConversation,
} from "@/lib/db/doc";
import { getMemoriesForMasterAgent, addMemory } from "@/lib/db/master-agent-memories";
import { getAssignedFileIdsForMaster } from "@/lib/db/file-assignments";
import { db } from "@/lib/db";
import { files, agents } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";
import { createMasterAgent, createSubagent } from "./create-agent";
import { log } from "@/lib/logger";

function withToolLog<T>(
  toolName: string,
  conversationId: string,
  argsSummary: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const toolLog = log.child({ toolName, conversationId });
  toolLog.info("tool.execute_start", argsSummary);
  const startMs = Date.now();
  return fn().then(
    (out) => {
      toolLog.info("tool.execute_finish", { durationMs: Date.now() - startMs });
      return out;
    },
    (err) => {
      toolLog.warn("tool.execute_error", {
        durationMs: Date.now() - startMs,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  );
}

export function createMasterTools(conversationId: string, masterAgentId: string | null) {
  return {
    create_agent: tool({
      description:
        "Create a new master agent or subagent. Use subagent for specialists the master can invoke via invoke_agent; use master for another coordinator.",
      inputSchema: zodSchema(
        z.object({
          type: z.enum(["master", "subagent"]).describe("Whether to create a master agent or a subagent"),
          name: z.string().describe("Display name for the agent"),
          systemPrompt: z.string().describe("System prompt that defines the agent's behavior"),
          model: z.string().optional().describe("Optional model override"),
          maxSteps: z.number().min(1).max(100).optional().describe("Max steps (subagent 1-50, master 1-100)"),
          thinkingEnabled: z.boolean().optional().describe("Enable extended thinking"),
          toolIds: z.array(z.string()).optional().describe("IDs of tools to assign to the agent"),
          knowledge: z.string().optional().describe("Optional knowledge text (subagent only)"),
        })
      ),
      execute: async ({ type, name, systemPrompt, model, maxSteps, thinkingEnabled, toolIds, knowledge }) =>
        withToolLog(
          "create_agent",
          conversationId,
          { type, name },
          async () => {
            const userId = getDefaultUserId();
            try {
              if (type === "master") {
                const created = await createMasterAgent(userId, {
                  name,
                  systemPrompt,
                  model: model ?? null,
                  maxSteps: maxSteps ?? null,
                  thinkingEnabled: thinkingEnabled ?? undefined,
                  toolIds,
                });
                return { id: created.id, name: created.name, type: "master" as const };
              }
              const created = await createSubagent(userId, {
                name,
                systemPrompt,
                model: model ?? null,
                knowledge: knowledge ?? null,
                maxSteps: maxSteps ?? null,
                thinkingEnabled: thinkingEnabled ?? undefined,
                toolIds,
              });
              return { id: created.id, name: created.name, type: "subagent" as const };
            } catch (e) {
              const message = e instanceof Error ? e.message : "Failed to create agent";
              return { error: message };
            }
          }
        ),
    }),
    invoke_agent: tool({
      description:
        "Delegate a task to a user-created agent by ID. Use when the user's question or task matches this agent's expertise; pass the exact agent ID from the list and a self-contained message for that specialist.",
      inputSchema: zodSchema(
        z.object({
          agentId: z.string().describe("The ID of the user-created agent to invoke"),
          message: z.string().describe("The message or task to send to the agent"),
          context: z.string().optional().describe("Optional context for the sub-agent (e.g. user's original question or a doc excerpt)"),
        })
      ),
      execute: async ({ agentId, message, context }) =>
        withToolLog("invoke_agent", conversationId, { agentId, messageLength: message.length, hasContext: Boolean(context) }, async () => {
          const out = await runUserAgent(agentId, message, context);
          const agentRow = await db.query.agents.findFirst({
            where: and(eq(agents.id, agentId), eq(agents.userId, getDefaultUserId())),
            columns: { name: true },
          });
          return {
            result: out.result,
            agentName: agentRow?.name ?? undefined,
            ...(out.summary != null && { summary: out.summary }),
            ...(out.detail != null && { detail: out.detail }),
          };
        }),
    }),
    list_docs: tool({
      description: "List all docs in this conversation. Returns id and title for each. Use before create_doc or write_to_doc to target a specific doc.",
      inputSchema: zodSchema(z.object({})),
      execute: async () =>
        withToolLog("list_docs", conversationId, {}, async () => {
          const docs = await listDocsByConversationId(conversationId);
          return {
            docs: docs.map((d) => ({ id: d.id, title: d.title, updatedAt: d.updatedAt?.toISOString?.() ?? null })),
            message: `Found ${docs.length} doc(s).`,
          };
        }),
    }),
    create_doc: tool({
      description: "Create a new doc in this conversation. Optionally set title and initial content. Returns the new doc id and title.",
      inputSchema: zodSchema(
        z.object({
          title: z.string().optional().describe("Doc title; defaults to 'Doc'"),
          content: z.string().optional().describe("Initial markdown content"),
        })
      ),
      execute: async ({ title, content }) =>
        withToolLog("create_doc", conversationId, { title: title ?? "Doc" }, async () => {
          const created = await createDoc(conversationId, { title, content });
          if (!created) return { error: "Failed to create doc" };
          return { id: created.id, title: created.title, message: `Created doc "${created.title}".` };
        }),
    }),
    rename_doc: tool({
      description: "Rename a doc by id. Use list_docs to get doc ids.",
      inputSchema: zodSchema(
        z.object({
          docId: z.string().describe("Doc ID from list_docs"),
          title: z.string().describe("New title for the doc"),
        })
      ),
      execute: async ({ docId, title }) =>
        withToolLog("rename_doc", conversationId, { docId, title }, async () => {
          const out = await updateDocTitle(docId, conversationId, title);
          if (!out) return { error: "Doc not found" };
          return { id: out.id, title: out.title, message: `Renamed to "${out.title}".` };
        }),
    }),
    delete_doc: tool({
      description: "Delete a doc by id. Use list_docs to get doc ids. Cannot delete the last remaining doc.",
      inputSchema: zodSchema(
        z.object({
          docId: z.string().describe("Doc ID from list_docs"),
        })
      ),
      execute: async ({ docId }) =>
        withToolLog("delete_doc", conversationId, { docId }, async () => {
          const docs = await listDocsByConversationId(conversationId);
          if (docs.length <= 1) return { error: "Cannot delete the last doc." };
          const deleted = await deleteDoc(docId, conversationId);
          if (!deleted) return { error: "Doc not found" };
          return { ok: true, message: "Doc deleted." };
        }),
    }),
    write_to_doc: tool({
      description:
        "Append or replace content in a working doc. Use docId to target a specific doc (from list_docs); omit for the default doc. Use 'append' to add at the end; use 'replace' to set full content. Only call when the user is not editing that doc.",
      inputSchema: zodSchema(
        z.object({
          mode: z.enum(["append", "replace"]).describe("append = add at end, replace = set full content"),
          content: z.string().describe("The text to append or the full doc content"),
          docId: z.string().optional().describe("Doc ID from list_docs; omit to use the default doc"),
        })
      ),
      execute: async ({ mode, content, docId }) =>
        withToolLog("write_to_doc", conversationId, { mode, docId }, async () => {
          const out = await appendOrReplaceDoc(conversationId, mode, content, true, docId);
          if (out === null) return { error: "Working doc not found" };
          if ("conflict" in out && out.conflict) {
            return { error: "Doc is being edited by the user. Try again later." };
          }
          return { ok: true, message: mode === "append" ? "Appended to doc." : "Doc replaced." };
        }),
    }),
    word_count: tool({
      description:
        "Return the exact word count for a doc. Use this instead of counting manually to avoid wasting tokens. Use list_docs to get doc ids; omit docId to use the default doc.",
      inputSchema: zodSchema(
        z.object({
          docId: z.string().optional().describe("Doc ID from list_docs; omit to use the default doc"),
        })
      ),
      execute: async ({ docId }) =>
        withToolLog("word_count", conversationId, { docId }, async () => {
          const doc = docId
            ? await getDocById(docId, conversationId)
            : await getDefaultDocForConversation(conversationId);
          if (!doc) return { error: "Doc not found" };
          const content = doc.content ?? "";
          const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
          return {
            wordCount,
            docId: doc.id,
            title: doc.title,
            message: `"${doc.title}" has ${wordCount} word(s).`,
          };
        }),
    }),
    research: tool({
      description:
        "Search or summarize the user's uploaded files. Returns text content from files (md, txt, csv, pdf) that the user has uploaded. Use this to answer questions using the user's data.",
      inputSchema: zodSchema(
        z.object({
          query: z.string().optional().describe("Optional search/summary query; if omitted, list all file summaries"),
        })
      ),
      execute: async ({ query }) =>
        withToolLog("research", conversationId, { hasQuery: !!query }, async () => {
          const userId = getDefaultUserId();
          const assignedFileIds =
            masterAgentId
              ? await getAssignedFileIdsForMaster(masterAgentId)
              : [];
          const list = await db.query.files.findMany({
            where:
              assignedFileIds.length > 0
                ? and(eq(files.userId, userId), inArray(files.id, assignedFileIds))
                : eq(files.userId, userId),
            columns: { id: true, filename: true, textContent: true },
          });
          if (list.length === 0) {
            return {
              files: [],
              message:
                assignedFileIds.length > 0
                  ? "No files assigned to this master agent."
                  : "No uploaded files.",
            };
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
        }),
    }),
    remember: tool({
      description:
        "Store a fact or piece of information in long-term memory for use in future conversations. Use for user preferences, important decisions, or context that should persist across chats.",
      inputSchema: zodSchema(
        z.object({
          content: z.string().describe("The fact or information to remember"),
        })
      ),
      execute: async ({ content }) =>
        withToolLog("remember", conversationId, { contentLength: content.length }, async () => {
          const { id } = await addMemory(masterAgentId, content);
          return { ok: true, id, message: "Stored in long-term memory." };
        }),
    }),
    recall: tool({
      description:
        "Retrieve recent long-term memories. Optionally pass a query to filter by keyword (simple text match). Use when you need to look up something previously remembered.",
      inputSchema: zodSchema(
        z.object({
          query: z.string().optional().describe("Optional keyword(s) to filter memories; if omitted, returns recent memories"),
        })
      ),
      execute: async ({ query }) =>
        withToolLog("recall", conversationId, { hasQuery: !!(query?.trim()) }, async () => {
          const memories = await getMemoriesForMasterAgent(masterAgentId, { limit: 20 });
          if (memories.length === 0) {
            return { memories: [], message: "No long-term memories found." };
          }
          let filtered = memories;
          if (query && query.trim()) {
            const lower = query.toLowerCase().trim();
            filtered = memories.filter((m) => m.content.toLowerCase().includes(lower));
          }
          return {
            memories: filtered.map((m) => ({ id: m.id, content: m.content, createdAt: m.createdAt.toISOString() })),
            message: `Found ${filtered.length} memory(ies).`,
          };
        }),
    }),
  };
}

export const MASTER_SYSTEM_PROMPT = `You are the Master agent. You coordinate work by:
1. Delegating to user-created agents via the invoke_agent tool (pass agentId and message).
2. Using the working docs: list_docs to see docs, create_doc to add a doc, rename_doc and delete_doc to rename or delete by id, write_to_doc (append or replace) to write; pass docId to target a specific doc. Only write when the user is not editing that doc. Cannot delete the last remaining doc. Use word_count to get the exact word count for a doc when needed (do not count manually—it wastes tokens).
3. Using the research tool to search/summarize the user's uploaded files.

Always be helpful and concise. When you delegate to another agent, use their result as follows:
- If the sub-agent returns a structured list (e.g. SERP results with Position, Title, URL, Description in markdown), present that list in full to the user. Prefer writing it to the working doc via write_to_doc and then briefly tell the user it's in the doc, or paste the full list in your reply. Do not replace a formatted list with a short summary.
- For other sub-agent results (narrative, short answers), summarize for the user or use the working doc for long content. When a sub-agent returns summary and detail, you may use summary for a brief reply and detail for the full answer.`;
