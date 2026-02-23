import { db } from "./index";
import { workingDocs } from "./schema";
import { eq, and } from "drizzle-orm";

export async function getDefaultDocForConversation(conversationId: string) {
  return db.query.workingDocs.findFirst({
    where: eq(workingDocs.conversationId, conversationId),
    orderBy: (wd, { asc }) => [asc(wd.id)],
  });
}

/** @deprecated Use getDefaultDocForConversation for default doc */
export async function getDocByConversationId(conversationId: string) {
  return getDefaultDocForConversation(conversationId);
}

export async function listDocsByConversationId(conversationId: string) {
  return db.query.workingDocs.findMany({
    where: eq(workingDocs.conversationId, conversationId),
    columns: { id: true, title: true, updatedAt: true },
    orderBy: (wd, { asc }) => [asc(wd.id)],
  });
}

export async function getDocById(docId: string, conversationId: string) {
  return db.query.workingDocs.findFirst({
    where: and(
      eq(workingDocs.id, docId),
      eq(workingDocs.conversationId, conversationId)
    ),
  });
}

export async function setDocLock(
  conversationId: string,
  lockHolder: "user" | "agent" | null
) {
  const doc = await getDefaultDocForConversation(conversationId);
  if (!doc) return;
  await db
    .update(workingDocs)
    .set({ lockHolder, updatedAt: new Date() })
    .where(eq(workingDocs.id, doc.id));
}

export async function createDoc(
  conversationId: string,
  opts: { title?: string; content?: string } = {}
) {
  const { randomUUID } = await import("crypto");
  const id = randomUUID();
  await db.insert(workingDocs).values({
    id,
    conversationId,
    title: opts.title?.trim() || "Doc",
    content: opts.content ?? "",
    updatedAt: new Date(),
  });
  const created = await getDocById(id, conversationId);
  return created;
}

export async function updateDocContent(
  conversationId: string,
  content: string,
  asAgent: boolean,
  docId?: string
) {
  const doc = docId
    ? await getDocById(docId, conversationId)
    : await getDefaultDocForConversation(conversationId);
  if (!doc) return null;
  if (asAgent) {
    if (doc.lockHolder === "user") return { conflict: true };
    await db
      .update(workingDocs)
      .set({ content, updatedAt: new Date() })
      .where(eq(workingDocs.id, doc.id));
    return { ok: true };
  }
  if (doc.lockHolder === "agent") return { conflict: true };
  await db
    .update(workingDocs)
    .set({ content, updatedAt: new Date() })
    .where(eq(workingDocs.id, doc.id));
  return { ok: true };
}

export async function appendOrReplaceDoc(
  conversationId: string,
  mode: "append" | "replace",
  content: string,
  asAgent: boolean,
  docId?: string
) {
  const doc = docId
    ? await getDocById(docId, conversationId)
    : await getDefaultDocForConversation(conversationId);
  if (!doc) return null;
  if (asAgent && doc.lockHolder === "user") return { conflict: true };
  if (!asAgent && doc.lockHolder === "agent") return { conflict: true };
  const newContent =
    mode === "replace" ? content : (doc.content ?? "") + "\n" + content;
  await db
    .update(workingDocs)
    .set({ content: newContent.trim(), updatedAt: new Date() })
    .where(eq(workingDocs.id, doc.id));
  return { ok: true, content: newContent.trim() };
}

export async function updateDocTitle(
  docId: string,
  conversationId: string,
  title: string
) {
  const doc = await getDocById(docId, conversationId);
  if (!doc) return null;
  const trimmed = title?.trim() || "Doc";
  await db
    .update(workingDocs)
    .set({ title: trimmed, updatedAt: new Date() })
    .where(eq(workingDocs.id, docId));
  return { id: docId, title: trimmed };
}

export async function deleteDoc(docId: string, conversationId: string) {
  const doc = await getDocById(docId, conversationId);
  if (!doc) return false;
  await db.delete(workingDocs).where(eq(workingDocs.id, docId));
  return true;
}
