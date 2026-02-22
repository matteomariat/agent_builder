import { tool, zodSchema } from "ai";
import { z } from "zod";
import { getDefaultUserId } from "@/lib/db/users";
import { createSubagent } from "./create-agent";
import { db } from "@/lib/db";
import { agents, agentTools, files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  listKnowledgeItems,
  createKnowledgeItem,
  updateKnowledgeItem,
  deleteKnowledgeItem,
} from "@/lib/db/knowledge";
import { setFileAssignmentsForAgent } from "@/lib/db/file-assignments";
import { log } from "@/lib/logger";

function withLog<T>(
  toolName: string,
  argsSummary: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const toolLog = log.child({ toolName, context: "builder" });
  toolLog.info("builder_tool.execute_start", argsSummary);
  const startMs = Date.now();
  return fn().then(
    (out) => {
      toolLog.info("builder_tool.execute_finish", { durationMs: Date.now() - startMs });
      return out;
    },
    (err) => {
      toolLog.warn("builder_tool.execute_error", {
        durationMs: Date.now() - startMs,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  );
}

export function createBuilderTools() {
  return {
    create_agent: tool({
      description:
        "Create a new subagent. Use for specialists the user can invoke. Returns the new agent id and name.",
      inputSchema: zodSchema(
        z.object({
          name: z.string().describe("Display name for the agent"),
          systemPrompt: z.string().describe("System prompt that defines the agent's behavior"),
          model: z.string().optional().describe("Optional model override"),
          maxSteps: z.number().min(1).max(50).optional().describe("Max steps (1-50)"),
          thinkingEnabled: z.boolean().optional().describe("Enable extended thinking"),
          toolIds: z.array(z.string()).optional().describe("IDs of tools to assign to the agent"),
          knowledge: z.string().optional().describe("Optional legacy knowledge text"),
        })
      ),
      execute: async ({ name, systemPrompt, model, maxSteps, thinkingEnabled, toolIds, knowledge }) =>
        withLog("create_agent", { name }, async () => {
          const userId = getDefaultUserId();
          try {
            const created = await createSubagent(userId, {
              name,
              systemPrompt,
              model: model ?? null,
              knowledge: knowledge ?? null,
              maxSteps: maxSteps ?? null,
              thinkingEnabled: thinkingEnabled ?? undefined,
              toolIds,
            });
            return { id: created.id, name: created.name };
          } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to create agent";
            return { error: message };
          }
        }),
    }),

    update_agent: tool({
      description: "Update an existing subagent by id. Pass only the fields to change.",
      inputSchema: zodSchema(
        z.object({
          agentId: z.string().describe("The agent ID to update"),
          name: z.string().optional().describe("New display name"),
          systemPrompt: z.string().optional().describe("New system prompt"),
          model: z.string().nullable().optional().describe("Model or null for default"),
          maxSteps: z.number().min(1).max(50).nullable().optional(),
          thinkingEnabled: z.boolean().optional(),
          toolIds: z.array(z.string()).optional().describe("Replace tool assignments"),
          knowledge: z.string().nullable().optional().describe("Legacy knowledge text"),
        })
      ),
      execute: async ({ agentId, name, systemPrompt, model, maxSteps, thinkingEnabled, toolIds, knowledge }) =>
        withLog("update_agent", { agentId }, async () => {
          const userId = getDefaultUserId();
          const existing = await db.query.agents.findFirst({
            where: and(eq(agents.id, agentId), eq(agents.userId, userId)),
          });
          if (!existing) return { error: "Agent not found" };
          const updates: Record<string, unknown> = {};
          if (name !== undefined) updates.name = name.trim();
          if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt.trim();
          if (model !== undefined) updates.model = model;
          if (maxSteps !== undefined) updates.maxSteps = maxSteps;
          if (thinkingEnabled !== undefined) updates.thinkingEnabled = thinkingEnabled;
          if (knowledge !== undefined) updates.knowledge = knowledge;
          if (Object.keys(updates).length > 0) {
            await db.update(agents).set(updates as Record<string, unknown>).where(and(eq(agents.id, agentId), eq(agents.userId, userId)));
          }
          if (toolIds !== undefined) {
            await db.delete(agentTools).where(eq(agentTools.agentId, agentId));
            if (toolIds.length > 0) {
              await db.insert(agentTools).values(toolIds.map((toolId) => ({ agentId, toolId })));
            }
          }
          return { ok: true, id: agentId };
        }),
    }),

    delete_agent: tool({
      description: "Delete a subagent by id. Use only when the user confirms.",
      inputSchema: zodSchema(z.object({ agentId: z.string().describe("The agent ID to delete") })),
      execute: async ({ agentId }) =>
        withLog("delete_agent", { agentId }, async () => {
          const userId = getDefaultUserId();
          const existing = await db.query.agents.findFirst({
            where: and(eq(agents.id, agentId), eq(agents.userId, userId)),
          });
          if (!existing) return { error: "Agent not found" };
          await db.delete(agents).where(and(eq(agents.id, agentId), eq(agents.userId, userId)));
          return { ok: true };
        }),
    }),

    get_agent: tool({
      description: "Get one subagent by id (name, systemPrompt, model, maxSteps, thinkingEnabled, toolIds).",
      inputSchema: zodSchema(z.object({ agentId: z.string().describe("The agent ID") })),
      execute: async ({ agentId }) =>
        withLog("get_agent", { agentId }, async () => {
          const userId = getDefaultUserId();
          const row = await db.query.agents.findFirst({
            where: and(eq(agents.id, agentId), eq(agents.userId, userId)),
          });
          if (!row) return { error: "Agent not found" };
          const toolRows = await db.query.agentTools.findMany({
            where: eq(agentTools.agentId, agentId),
            columns: { toolId: true },
          });
          return {
            id: row.id,
            name: row.name,
            systemPrompt: row.systemPrompt,
            model: row.model,
            maxSteps: row.maxSteps,
            thinkingEnabled: row.thinkingEnabled,
            knowledge: row.knowledge,
            toolIds: toolRows.map((r) => r.toolId),
          };
        }),
    }),

    list_agents: tool({
      description: "List all subagents for the user (id, name, and optional one-line description from system prompt).",
      inputSchema: zodSchema(z.object({})),
      execute: async () =>
        withLog("list_agents", {}, async () => {
          const userId = getDefaultUserId();
          const list = await db.query.agents.findMany({
            where: eq(agents.userId, userId),
            columns: { id: true, name: true, systemPrompt: true },
          });
          return {
            agents: list.map((a) => ({
              id: a.id,
              name: a.name,
              description: a.systemPrompt?.trim().split(/\n/)[0]?.slice(0, 120) ?? "",
            })),
          };
        }),
    }),

    focus_agent: tool({
      description:
        "Open an agent in the right-pane form for editing. Call this when the user wants to edit a specific agent. Use list_agents to find candidates by name; if exactly one matches, call focus_agent with that id. If multiple agents match, ask the user to confirm which one (e.g. by name or id), then call focus_agent with the chosen agentId. Returns agentId so the UI loads that agent.",
      inputSchema: zodSchema(
        z.object({
          agentId: z.string().describe("The agent ID to open in the form"),
          reason: z.string().optional().describe("Optional: why this agent was chosen (e.g. 'user asked to edit Sales Bot')"),
        })
      ),
      execute: async ({ agentId, reason }) =>
        withLog("focus_agent", { agentId }, async () => {
          const userId = getDefaultUserId();
          const existing = await db.query.agents.findFirst({
            where: and(eq(agents.id, agentId), eq(agents.userId, userId)),
            columns: { id: true, name: true },
          });
          if (!existing) return { error: "Agent not found", agentId };
          return { ok: true, agentId: existing.id, name: existing.name };
        }),
    }),

    list_knowledge: tool({
      description: "List knowledge items for an owner (agent or master). Use ownerType 'agent' and ownerId = agent id.",
      inputSchema: zodSchema(
        z.object({
          ownerType: z.enum(["master", "agent", "default"]).describe("Owner type"),
          ownerId: z.string().nullable().optional().describe("Owner id; null or omit for default"),
        })
      ),
      execute: async ({ ownerType, ownerId }) =>
        withLog("list_knowledge", { ownerType }, async () => {
          const userId = getDefaultUserId();
          const items = await listKnowledgeItems(userId, {
            ownerType: ownerType as "master" | "agent" | "default",
            ownerId: ownerId ?? undefined,
          });
          return {
            items: items.map((i) => ({
              id: i.id,
              type: i.type,
              content: i.content,
              sortOrder: i.sortOrder,
            })),
          };
        }),
    }),

    create_knowledge: tool({
      description: "Create a knowledge item (guidance, rules, or style) for an agent or master.",
      inputSchema: zodSchema(
        z.object({
          ownerType: z.enum(["master", "agent", "default"]),
          ownerId: z.string().optional().describe("Required when ownerType is not default"),
          type: z.enum(["guidance", "rules", "style"]),
          content: z.string(),
          sortOrder: z.number().optional(),
        })
      ),
      execute: async ({ ownerType, ownerId, type, content, sortOrder }) =>
        withLog("create_knowledge", { ownerType, type }, async () => {
          const userId = getDefaultUserId();
          const created = await createKnowledgeItem(
            userId,
            {
              ownerType: ownerType as "master" | "agent" | "default",
              ownerId: ownerType === "default" ? null : ownerId ?? null,
              type: type as "guidance" | "rules" | "style",
              content,
              sortOrder,
            }
          );
          return { id: created?.id, type: created?.type };
        }),
    }),

    update_knowledge: tool({
      description: "Update a knowledge item by id (content and/or sortOrder).",
      inputSchema: zodSchema(
        z.object({
          id: z.string(),
          content: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      ),
      execute: async ({ id, content, sortOrder }) =>
        withLog("update_knowledge", { id }, async () => {
          const userId = getDefaultUserId();
          await updateKnowledgeItem(id, userId, { content, sortOrder });
          return { ok: true };
        }),
    }),

    delete_knowledge: tool({
      description: "Delete a knowledge item by id. Use only when the user confirms.",
      inputSchema: zodSchema(z.object({ id: z.string() })),
      execute: async ({ id }) =>
        withLog("delete_knowledge", { id }, async () => {
          const userId = getDefaultUserId();
          await deleteKnowledgeItem(id, userId);
          return { ok: true };
        }),
    }),

    list_files: tool({
      description: "List the user's uploaded files (id, filename).",
      inputSchema: zodSchema(z.object({})),
      execute: async () =>
        withLog("list_files", {}, async () => {
          const userId = getDefaultUserId();
          const list = await db.query.files.findMany({
            where: eq(files.userId, userId),
            columns: { id: true, filename: true, mimeType: true },
          });
          return {
            files: list.map((f) => ({ id: f.id, filename: f.filename, mimeType: f.mimeType })),
          };
        }),
    }),

    get_file: tool({
      description: "Get one file by id. Includes textContent for .md, .txt, .csv files.",
      inputSchema: zodSchema(z.object({ fileId: z.string() })),
      execute: async ({ fileId }) =>
        withLog("get_file", { fileId }, async () => {
          const userId = getDefaultUserId();
          const row = await db.query.files.findFirst({
            where: and(eq(files.id, fileId), eq(files.userId, userId)),
          });
          if (!row) return { error: "File not found" };
          const editable = [".md", ".txt", ".csv"].some((ext) =>
            row.filename.toLowerCase().endsWith(ext)
          );
          return {
            id: row.id,
            filename: row.filename,
            mimeType: row.mimeType,
            ...(editable && { textContent: row.textContent ?? "" }),
          };
        }),
    }),

    update_file: tool({
      description: "Update a file's filename or text content (only for .md, .txt, .csv).",
      inputSchema: zodSchema(
        z.object({
          fileId: z.string(),
          filename: z.string().optional(),
          textContent: z.string().optional(),
        })
      ),
      execute: async ({ fileId, filename, textContent }) =>
        withLog("update_file", { fileId }, async () => {
          const userId = getDefaultUserId();
          const existing = await db.query.files.findFirst({
            where: and(eq(files.id, fileId), eq(files.userId, userId)),
          });
          if (!existing) return { error: "File not found" };
          const updates: { filename?: string; textContent?: string } = {};
          if (filename !== undefined) updates.filename = filename.trim();
          if (textContent !== undefined) {
            const editable = [".md", ".txt", ".csv"].some((ext) =>
              existing.filename.toLowerCase().endsWith(ext)
            );
            if (!editable) return { error: "Only text/markdown/csv files can be edited" };
            updates.textContent = textContent;
          }
          if (Object.keys(updates).length === 0) return { ok: true };
          await db.update(files).set(updates).where(and(eq(files.id, fileId), eq(files.userId, userId)));
          return { ok: true };
        }),
    }),

    set_agent_file_assignments: tool({
      description: "Set which files are assigned to an agent (RAG). Replaces existing assignments.",
      inputSchema: zodSchema(
        z.object({
          agentId: z.string(),
          fileIds: z.array(z.string()).describe("List of file IDs to assign"),
        })
      ),
      execute: async ({ agentId, fileIds }) =>
        withLog("set_agent_file_assignments", { agentId, count: fileIds.length }, async () => {
          const userId = getDefaultUserId();
          const ok = await setFileAssignmentsForAgent(agentId, userId, fileIds);
          return ok ? { ok: true } : { error: "Agent not found or invalid file ids" };
        }),
    }),
  };
}

export { BUILDER_SYSTEM_PROMPT } from "./builder-constants";
