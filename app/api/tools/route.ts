import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ensureDefaultUser } from "@/lib/db/users";
import { randomUUID } from "crypto";
import { RESERVED_TOOL_NAMES } from "@/lib/agents/configured-tools";

export async function GET() {
  const userId = await ensureDefaultUser();
  const list = await db.query.tools.findMany({
    where: eq(tools.userId, userId),
  });
  return NextResponse.json(list);
}

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

export async function POST(request: NextRequest) {
  const userId = await ensureDefaultUser();
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
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const type = body.type === "api" ? "api" : "api";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (RESERVED_TOOL_NAMES.includes(name as (typeof RESERVED_TOOL_NAMES)[number])) {
    return NextResponse.json(
      { error: `name cannot be reserved: ${RESERVED_TOOL_NAMES.join(", ")}` },
      { status: 400 }
    );
  }
  const byName = await db.query.tools.findMany({
    where: eq(tools.userId, userId),
    columns: { name: true },
  });
  if (byName.some((t) => t.name === name)) {
    return NextResponse.json({ error: "name must be unique per user" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  let configJson: string;
  if (type === "api") {
    const apiConfig = validateApiConfig(body.config);
    if (!apiConfig) {
      return NextResponse.json(
        { error: "config must have url, method, and inputSchema (JSON Schema object)" },
        { status: 400 }
      );
    }
    configJson = JSON.stringify(apiConfig);
  } else {
    configJson = JSON.stringify({ url: "", method: "GET", inputSchema: { type: "object", properties: {} } });
  }
  const id = randomUUID();
  await db.insert(tools).values({
    id,
    userId,
    name,
    description,
    type,
    config: configJson,
  });
  const row = await db.query.tools.findFirst({
    where: eq(tools.id, id),
  });
  return NextResponse.json(row);
}
