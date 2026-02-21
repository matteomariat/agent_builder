import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ensureDefaultUser } from "@/lib/db/users";
import { randomUUID } from "crypto";

export async function GET() {
  const userId = await ensureDefaultUser();
  const list = await db.query.agents.findMany({
    where: eq(agents.userId, userId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
  return NextResponse.json(
    list.map((a) => ({
      ...a,
      createdAt: a.createdAt?.toISOString?.() ?? a.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const userId = await ensureDefaultUser();
  let body: { name?: string; systemPrompt?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, systemPrompt, model } = body;
  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }
  if (!systemPrompt || typeof systemPrompt !== "string") {
    return NextResponse.json(
      { error: "systemPrompt is required" },
      { status: 400 }
    );
  }
  const id = randomUUID();
  await db.insert(agents).values({
    id,
    userId,
    name: name.trim(),
    systemPrompt: systemPrompt.trim(),
    model: model && typeof model === "string" ? model.trim() : null,
    createdAt: new Date(),
  });
  const row = await db.query.agents.findFirst({
    where: eq(agents.id, id),
  });
  return NextResponse.json({
    ...row,
    createdAt: row?.createdAt?.toISOString?.() ?? row?.createdAt,
  });
}
