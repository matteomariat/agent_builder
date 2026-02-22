import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { ensureDefaultUser } from "@/lib/db/users";
import { getFileIdsAssignedToAgent } from "@/lib/db/file-assignments";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await ensureDefaultUser();
  const { id: agentId } = await params;
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.userId, userId)),
    columns: { id: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  const files = await getFileIdsAssignedToAgent(agentId, userId);
  return NextResponse.json(
    files.map((f) => ({ id: f.id, filename: f.filename }))
  );
}
