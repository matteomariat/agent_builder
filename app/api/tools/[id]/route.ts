import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";
import { RESERVED_TOOL_NAMES } from "@/lib/agents/configured-tools";

function validateApiConfig(config: unknown): { url: string; method: string; headers?: Record<string, string>; inputSchema: object } | null {
  if (!config || typeof config !== "object") return null;
  const c = config as Record<string, unknown>;
  if (typeof c.url !== "string" || !c.url.trim()) return null;
  if (typeof c.method !== "string" || !c.method.trim()) return null;
  if (!c.inputSchema || typeof c.inputSchema !== "object") return null;
  const inputSchema = c.inputSchema as object;
  const out: { url: string; method: string; headers?: Record<string, string>; inputSchema: object } = {
    url: (c.url as string).trim(),
    method: (c.method as string).trim().toUpperCase(),
    inputSchema,
  };
  if (c.headers && typeof c.headers === "object" && !Array.isArray(c.headers)) {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(c.headers)) {
      if (typeof v === "string") headers[k] = v;
    }
    out.headers = headers;
  }
  return out;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getDefaultUserId();
  const row = await db.query.tools.findFirst({
    where: and(eq(tools.id, id), eq(tools.userId, userId)),
  });
  if (!row) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getDefaultUserId();
  const existing = await db.query.tools.findFirst({
    where: and(eq(tools.id, id), eq(tools.userId, userId)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }
  let body: {
    name?: string;
    description?: string;
    type?: string;
    config?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const updates: { name?: string; description?: string; type?: "api"; config?: string } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    if (RESERVED_TOOL_NAMES.includes(name as (typeof RESERVED_TOOL_NAMES)[number])) {
      return NextResponse.json(
        { error: `name cannot be reserved: ${RESERVED_TOOL_NAMES.join(", ")}` },
        { status: 400 }
      );
    }
    const byName = await db.query.tools.findMany({
      where: eq(tools.userId, userId),
      columns: { id: true, name: true },
    });
    if (byName.some((t) => t.name === name && t.id !== id)) {
      return NextResponse.json({ error: "name must be unique per user" }, { status: 400 });
    }
    updates.name = name;
  }
  if (body.description !== undefined) {
    updates.description =
      typeof body.description === "string" ? body.description.trim() : existing.description;
  }
  if (body.type === "api") {
    updates.type = "api";
  }
  if (body.config !== undefined && (updates.type === "api" || existing.type === "api")) {
    const apiConfig = validateApiConfig(body.config);
    if (!apiConfig) {
      return NextResponse.json(
        { error: "config must have url, method, and inputSchema (JSON Schema object)" },
        { status: 400 }
      );
    }
    updates.config = JSON.stringify(apiConfig);
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(existing);
  }
  await db
    .update(tools)
    .set(updates)
    .where(and(eq(tools.id, id), eq(tools.userId, userId)));
  const row = await db.query.tools.findFirst({
    where: eq(tools.id, id),
  });
  return NextResponse.json(row);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getDefaultUserId();
  const existing = await db.query.tools.findFirst({
    where: and(eq(tools.id, id), eq(tools.userId, userId)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }
  await db.delete(tools).where(and(eq(tools.id, id), eq(tools.userId, userId)));
  return NextResponse.json({ ok: true });
}
