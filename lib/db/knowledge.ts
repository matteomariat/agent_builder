import { db } from "./index";
import { knowledgeItems } from "./schema";
import { eq, and, isNull } from "drizzle-orm";
import type { KnowledgeItem } from "./schema";

const KNOWLEDGE_TYPE_ORDER = ["guidance", "rules", "style"] as const;
const TOKEN_CAPS: Record<(typeof KNOWLEDGE_TYPE_ORDER)[number], number> = {
  guidance: 500,
  rules: 300,
  style: 200,
};
const CHARS_PER_TOKEN = 4;

function truncateToTokenCap(text: string, tokens: number): string {
  const maxChars = tokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trim() + "\n[...truncated]";
}

export type OwnerType = "master" | "agent" | "default";

/**
 * Returns merged knowledge items: defaults first (ownerType=default), then owner-specific,
 * ordered by type (guidance → rules → style) and sortOrder.
 */
export async function getKnowledgeItemsForOwner(
  userId: string,
  ownerType: "master" | "agent",
  ownerId: string
): Promise<KnowledgeItem[]> {
  const defaultRows = await db.query.knowledgeItems.findMany({
    where: and(
      eq(knowledgeItems.userId, userId),
      eq(knowledgeItems.ownerType, "default")
    ),
    orderBy: (k, { asc }) => [asc(k.sortOrder)],
  });
  const ownerRows = await db.query.knowledgeItems.findMany({
    where: and(
      eq(knowledgeItems.userId, userId),
      eq(knowledgeItems.ownerType, ownerType),
      eq(knowledgeItems.ownerId, ownerId)
    ),
    orderBy: (k, { asc }) => [asc(k.sortOrder)],
  });
  const byType = new Map<string, KnowledgeItem[]>();
  for (const row of defaultRows) {
    const list = byType.get(row.type) ?? [];
    list.push(row);
    byType.set(row.type, list);
  }
  for (const row of ownerRows) {
    const list = byType.get(row.type) ?? [];
    list.push(row);
    byType.set(row.type, list);
  }
  const result: KnowledgeItem[] = [];
  for (const type of KNOWLEDGE_TYPE_ORDER) {
    const list = byType.get(type) ?? [];
    result.push(...list);
  }
  return result;
}

/**
 * Builds the knowledge block string for system prompt: ## Guidance, ## Rules, ## Style
 * with per-type token caps. Optionally appends legacy agent.knowledge if no items and legacy provided.
 */
export async function buildKnowledgeBlock(
  userId: string,
  ownerType: "master" | "agent",
  ownerId: string,
  options?: { agentLegacyKnowledge?: string | null }
): Promise<string> {
  const items = await getKnowledgeItemsForOwner(userId, ownerType, ownerId);
  const sections: string[] = [];

  for (const type of KNOWLEDGE_TYPE_ORDER) {
    const typeItems = items.filter((i) => i.type === type);
    const combined = typeItems.map((i) => i.content.trim()).filter(Boolean).join("\n\n");
    const cap = TOKEN_CAPS[type];
    const truncated = truncateToTokenCap(combined, cap);
    if (truncated) {
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      sections.push(`## ${label}\n${truncated}`);
    }
  }

  if (sections.length === 0 && options?.agentLegacyKnowledge?.trim()) {
    const legacy = truncateToTokenCap(
      options.agentLegacyKnowledge.trim(),
      TOKEN_CAPS.style
    );
    sections.push(`## Knowledge\n${legacy}`);
  }

  if (sections.length === 0) return "";
  return "\n\n---\n" + sections.join("\n\n");
}

export async function listKnowledgeItems(
  userId: string,
  filters?: { ownerType?: OwnerType; ownerId?: string | null }
) {
  const conditions = [eq(knowledgeItems.userId, userId)];
  if (filters?.ownerType !== undefined) {
    conditions.push(eq(knowledgeItems.ownerType, filters.ownerType));
  }
  if (filters?.ownerId !== undefined) {
    if (filters.ownerId == null || filters.ownerId === "") {
      conditions.push(isNull(knowledgeItems.ownerId));
    } else {
      conditions.push(eq(knowledgeItems.ownerId, filters.ownerId));
    }
  }
  return db.query.knowledgeItems.findMany({
    where: and(...conditions),
    orderBy: (k, { asc }) => [asc(k.sortOrder)],
  });
}

export async function getKnowledgeItemById(id: string, userId: string) {
  return db.query.knowledgeItems.findFirst({
    where: and(
      eq(knowledgeItems.id, id),
      eq(knowledgeItems.userId, userId)
    ),
  });
}

export async function createKnowledgeItem(
  userId: string,
  data: {
    ownerType: "master" | "agent" | "default";
    ownerId?: string | null;
    type: "guidance" | "rules" | "style";
    content: string;
    sortOrder?: number;
  },
  id?: string
) {
  const itemId = id ?? crypto.randomUUID();
  await db.insert(knowledgeItems).values({
    id: itemId,
    userId,
    ownerType: data.ownerType,
    ownerId: data.ownerType === "default" ? null : (data.ownerId ?? null),
    type: data.type,
    content: data.content.trim() || "",
    sortOrder: data.sortOrder ?? 0,
  });
  return db.query.knowledgeItems.findFirst({
    where: eq(knowledgeItems.id, itemId),
  });
}

export async function updateKnowledgeItem(
  id: string,
  userId: string,
  data: { content?: string; sortOrder?: number }
) {
  await db
    .update(knowledgeItems)
    .set({
      ...(data.content !== undefined && { content: data.content.trim() ?? "" }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    })
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)));
  return getKnowledgeItemById(id, userId);
}

export async function deleteKnowledgeItem(id: string, userId: string) {
  await db
    .delete(knowledgeItems)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)));
}
