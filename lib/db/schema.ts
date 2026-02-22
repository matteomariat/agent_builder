import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  storageKey: text("storage_key").notNull(),
  textContent: text("text_content"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const masterAgents = sqliteTable("master_agents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model"),
  maxSteps: integer("max_steps"),
  thinkingEnabled: integer("thinking_enabled", { mode: "boolean" }),
  toolIds: text("tool_ids"), // JSON array of tool IDs
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const masterAgentMemories = sqliteTable("master_agent_memories", {
  id: text("id").primaryKey(),
  masterAgentId: text("master_agent_id").references(() => masterAgents.id),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const tools = sqliteTable("tools", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type", { enum: ["api"] }).notNull().default("api"),
  config: text("config").notNull(), // JSON: { url, method, headers?, inputSchema }
});

export const agentTools = sqliteTable(
  "agent_tools",
  {
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    toolId: text("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.toolId] })]
);

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model"),
  knowledge: text("knowledge"),
  maxSteps: integer("max_steps"),
  thinkingEnabled: integer("thinking_enabled", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const builderConfig = sqliteTable("builder_config", {
  userId: text("user_id").primaryKey().references(() => users.id),
  systemPrompt: text("system_prompt"),
  model: text("model"),
  maxSteps: integer("max_steps"),
  thinkingEnabled: integer("thinking_enabled", { mode: "boolean" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull().default("New conversation"),
  masterAgentId: text("master_agent_id").references(() => masterAgents.id),
  isBuilder: integer("is_builder", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const workingDocs = sqliteTable("working_docs", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }).unique(),
  content: text("content").notNull().default(""),
  lockHolder: text("lock_holder", { enum: ["user", "agent"] }),
  lockExpiresAt: integer("lock_expires_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const knowledgeItemOwnerType = ["master", "agent", "default"] as const;
export const knowledgeItemType = ["guidance", "rules", "style"] as const;

export const knowledgeItems = sqliteTable("knowledge_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ownerType: text("owner_type", { enum: knowledgeItemOwnerType }).notNull(),
  ownerId: text("owner_id"), // null for ownerType='default'
  type: text("type", { enum: knowledgeItemType }).notNull(),
  content: text("content").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const fileAssignmentRole = ["rag", "reference"] as const;

export const fileAssignments = sqliteTable(
  "file_assignments",
  {
    fileId: text("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
    assigneeType: text("assignee_type", { enum: ["master", "agent"] }).notNull(),
    assigneeId: text("assignee_id").notNull(),
    role: text("role", { enum: fileAssignmentRole }),
  },
  (t) => [primaryKey({ columns: [t.fileId, t.assigneeType, t.assigneeId] })]
);

export type User = typeof users.$inferSelect;
export type BuilderConfig = typeof builderConfig.$inferSelect;
export type File = typeof files.$inferSelect;
export type MasterAgent = typeof masterAgents.$inferSelect;
export type MasterAgentMemory = typeof masterAgentMemories.$inferSelect;
export type Tool = typeof tools.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type WorkingDoc = typeof workingDocs.$inferSelect;
export type KnowledgeItem = typeof knowledgeItems.$inferSelect;
export type FileAssignment = typeof fileAssignments.$inferSelect;
