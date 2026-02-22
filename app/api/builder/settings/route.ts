import { NextRequest, NextResponse } from "next/server";
import { getDefaultUserId } from "@/lib/db/users";
import { getBuilderConfig, upsertBuilderConfig } from "@/lib/db/builder-config";

export async function GET() {
  const userId = getDefaultUserId();
  const config = await getBuilderConfig(userId);
  return NextResponse.json({
    systemPrompt: config?.systemPrompt ?? null,
    model: config?.model ?? null,
    maxSteps: config?.maxSteps ?? null,
    thinkingEnabled: config?.thinkingEnabled ?? null,
    updatedAt: config?.updatedAt?.toISOString?.() ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  const userId = getDefaultUserId();
  let body: {
    systemPrompt?: string | null;
    model?: string | null;
    maxSteps?: number | null;
    thinkingEnabled?: boolean | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const updates: {
    systemPrompt?: string | null;
    model?: string | null;
    maxSteps?: number | null;
    thinkingEnabled?: boolean | null;
  } = {};
  if (body.systemPrompt !== undefined) {
    updates.systemPrompt =
      body.systemPrompt != null && typeof body.systemPrompt === "string"
        ? body.systemPrompt.trim() || null
        : null;
  }
  if (body.model !== undefined) {
    updates.model =
      body.model != null && typeof body.model === "string" ? body.model.trim() || null : null;
  }
  if (body.maxSteps !== undefined) {
    const n = typeof body.maxSteps === "number" ? body.maxSteps : Number(body.maxSteps);
    updates.maxSteps =
      Number.isFinite(n) && n >= 1 && n <= 50 ? n : null;
  }
  if (body.thinkingEnabled !== undefined) {
    updates.thinkingEnabled = Boolean(body.thinkingEnabled);
  }
  const config = await upsertBuilderConfig(userId, updates);
  return NextResponse.json({
    systemPrompt: config.systemPrompt ?? null,
    model: config.model ?? null,
    maxSteps: config.maxSteps ?? null,
    thinkingEnabled: config.thinkingEnabled ?? null,
    updatedAt: config.updatedAt?.toISOString?.() ?? null,
  });
}
