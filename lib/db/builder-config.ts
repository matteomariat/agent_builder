import { db } from "./index";
import { builderConfig } from "./schema";
import { eq } from "drizzle-orm";

export type BuilderConfigRow = {
  userId: string;
  systemPrompt: string | null;
  model: string | null;
  maxSteps: number | null;
  thinkingEnabled: boolean | null;
  updatedAt: Date;
};

export async function getBuilderConfig(userId: string): Promise<BuilderConfigRow | null> {
  const row = await db.query.builderConfig.findFirst({
    where: eq(builderConfig.userId, userId),
  });
  return row ?? null;
}

export async function upsertBuilderConfig(
  userId: string,
  data: {
    systemPrompt?: string | null;
    model?: string | null;
    maxSteps?: number | null;
    thinkingEnabled?: boolean | null;
  }
): Promise<BuilderConfigRow> {
  const now = new Date();
  const existing = await getBuilderConfig(userId);
  const updates = {
    ...(data.systemPrompt !== undefined && { systemPrompt: data.systemPrompt }),
    ...(data.model !== undefined && { model: data.model }),
    ...(data.maxSteps !== undefined && { maxSteps: data.maxSteps }),
    ...(data.thinkingEnabled !== undefined && { thinkingEnabled: data.thinkingEnabled }),
    updatedAt: now,
  };
  if (existing) {
    await db
      .update(builderConfig)
      .set(updates)
      .where(eq(builderConfig.userId, userId));
    return { ...existing, ...updates } as BuilderConfigRow;
  }
  await db.insert(builderConfig).values({
    userId,
    systemPrompt: data.systemPrompt ?? null,
    model: data.model ?? null,
    maxSteps: data.maxSteps ?? null,
    thinkingEnabled: data.thinkingEnabled ?? null,
    updatedAt: now,
  });
  const row = await getBuilderConfig(userId);
  return row!;
}
