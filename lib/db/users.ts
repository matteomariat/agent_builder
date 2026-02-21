import { db } from "./index";
import { users } from "./schema";
import { eq } from "drizzle-orm";

const DEFAULT_USER_ID = "default-user";

export function getDefaultUserId(): string {
  return DEFAULT_USER_ID;
}

export async function ensureDefaultUser(): Promise<string> {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, DEFAULT_USER_ID),
  });
  if (existing) return DEFAULT_USER_ID;
  await db.insert(users).values({
    id: DEFAULT_USER_ID,
    name: "Default User",
    createdAt: new Date(),
  });
  return DEFAULT_USER_ID;
}
