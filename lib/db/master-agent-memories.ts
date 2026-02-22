import { db } from "./index";
import { masterAgentMemories } from "./schema";
import { eq, desc, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function getMemoriesForMasterAgent(
  masterAgentId: string | null,
  options?: { limit?: number }
): Promise<{ id: string; content: string; createdAt: Date }[]> {
  const limit = options?.limit ?? 50;
  const rows = await db.query.masterAgentMemories.findMany({
    where: masterAgentId
      ? eq(masterAgentMemories.masterAgentId, masterAgentId)
      : isNull(masterAgentMemories.masterAgentId),
    columns: { id: true, content: true, createdAt: true },
    orderBy: [desc(masterAgentMemories.createdAt)],
    limit,
  });
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt as unknown as number),
  }));
}

export async function addMemory(masterAgentId: string | null, content: string): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(masterAgentMemories).values({
    id,
    masterAgentId,
    content: content.trim(),
    createdAt: new Date(),
  });
  return { id };
}
