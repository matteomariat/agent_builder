import {
  sqliteTable,
  text,
  integer,
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

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull().default("New conversation"),
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

export type User = typeof users.$inferSelect;
export type File = typeof files.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type WorkingDoc = typeof workingDocs.$inferSelect;
