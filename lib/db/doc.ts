import { db } from "./index";
import { workingDocs } from "./schema";
import { eq } from "drizzle-orm";

export async function getDocByConversationId(conversationId: string) {
  return db.query.workingDocs.findFirst({
    where: eq(workingDocs.conversationId, conversationId),
  });
}

export async function setDocLock(
  conversationId: string,
  lockHolder: "user" | "agent" | null
) {
  await db
    .update(workingDocs)
    .set({ lockHolder, updatedAt: new Date() })
    .where(eq(workingDocs.conversationId, conversationId));
}

export async function updateDocContent(
  conversationId: string,
  content: string,
  asAgent: boolean
) {
  const doc = await db.query.workingDocs.findFirst({
    where: eq(workingDocs.conversationId, conversationId),
  });
  if (!doc) return null;
  if (asAgent) {
    if (doc.lockHolder === "user") return { conflict: true };
    await db
      .update(workingDocs)
      .set({ content, updatedAt: new Date() })
      .where(eq(workingDocs.conversationId, conversationId));
    return { ok: true };
  }
  if (doc.lockHolder === "agent") return { conflict: true };
  await db
    .update(workingDocs)
    .set({ content, updatedAt: new Date() })
    .where(eq(workingDocs.conversationId, conversationId));
  return { ok: true };
}

export async function appendOrReplaceDoc(
  conversationId: string,
  mode: "append" | "replace",
  content: string,
  asAgent: boolean
) {
  const doc = await db.query.workingDocs.findFirst({
    where: eq(workingDocs.conversationId, conversationId),
  });
  if (!doc) return null;
  if (asAgent && doc.lockHolder === "user") return { conflict: true };
  if (!asAgent && doc.lockHolder === "agent") return { conflict: true };
  const newContent =
    mode === "replace" ? content : (doc.content ?? "") + "\n" + content;
  await db
    .update(workingDocs)
    .set({ content: newContent.trim(), updatedAt: new Date() })
    .where(eq(workingDocs.conversationId, conversationId));
  return { ok: true, content: newContent.trim() };
}
