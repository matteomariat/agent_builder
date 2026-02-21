import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ensureDefaultUser } from "@/lib/db/users";

export async function GET() {
  const userId = await ensureDefaultUser();
  const list = await db.query.files.findMany({
    where: eq(files.userId, userId),
    columns: { id: true, filename: true, mimeType: true, createdAt: true },
    orderBy: (f, { desc }) => [desc(f.createdAt)],
  });
  return NextResponse.json(
    list.map((f) => ({
      ...f,
      createdAt: f.createdAt?.toISOString?.() ?? f.createdAt,
    }))
  );
}
