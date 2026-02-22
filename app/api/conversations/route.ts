import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, masterAgents } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { ensureDefaultUser } from "@/lib/db/users";
import { randomUUID } from "crypto";

export async function GET() {
  const userId = await ensureDefaultUser();
  const list = await db.query.conversations.findMany({
    where: and(eq(conversations.userId, userId), eq(conversations.isBuilder, false)),
    columns: { id: true, title: true, masterAgentId: true, createdAt: true, updatedAt: true },
    orderBy: (c, { desc }) => [desc(c.updatedAt)],
  });
  const masterAgentIds = [...new Set(list.map((c) => c.masterAgentId).filter(Boolean))] as string[];
  const masterAgentMap = new Map<string, string>();
  if (masterAgentIds.length > 0) {
    const agents = await db.query.masterAgents.findMany({
      where: inArray(masterAgents.id, masterAgentIds),
      columns: { id: true, name: true },
    });
    agents.forEach((a) => masterAgentMap.set(a.id, a.name));
  }
  return NextResponse.json(
    list.map((c) => ({
      id: c.id,
      title: c.title,
      masterAgentId: c.masterAgentId ?? null,
      masterAgentName: (c.masterAgentId && masterAgentMap.get(c.masterAgentId)) ?? null,
      createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
      updatedAt: c.updatedAt?.toISOString?.() ?? c.updatedAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const userId = await ensureDefaultUser();
  let body: { title?: string; masterAgentId?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New conversation";
  let masterAgentId: string | null = null;
  if (typeof body.masterAgentId === "string" && body.masterAgentId.trim()) {
    const ma = await db.query.masterAgents.findFirst({
      where: eq(masterAgents.id, body.masterAgentId.trim()),
      columns: { id: true, userId: true },
    });
    if (ma && ma.userId === userId) {
      masterAgentId = ma.id;
    }
  }
  const id = randomUUID();
  const now = new Date();
  await db.insert(conversations).values({
    id,
    userId,
    title,
    masterAgentId,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({
    id,
    title,
    masterAgentId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}
