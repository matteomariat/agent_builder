import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ensureDefaultUser } from "@/lib/db/users";
import { randomUUID } from "crypto";

export async function GET() {
  const userId = await ensureDefaultUser();
  const list = await db.query.conversations.findMany({
    where: eq(conversations.userId, userId),
    columns: { id: true, title: true, createdAt: true, updatedAt: true },
    orderBy: (c, { desc }) => [desc(c.updatedAt)],
  });
  return NextResponse.json(
    list.map((c) => ({
      ...c,
      createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
      updatedAt: c.updatedAt?.toISOString?.() ?? c.updatedAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const userId = await ensureDefaultUser();
  let body: { title?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New conversation";
  const id = randomUUID();
  const now = new Date();
  await db.insert(conversations).values({
    id,
    userId,
    title,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({
    id,
    title,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}
