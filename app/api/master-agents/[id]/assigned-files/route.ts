import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { masterAgents } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { ensureDefaultUser } from "@/lib/db/users";
import { getFileIdsAssignedToMaster } from "@/lib/db/file-assignments";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await ensureDefaultUser();
  const { id: masterAgentId } = await params;
  const master = await db.query.masterAgents.findFirst({
    where: and(
      eq(masterAgents.id, masterAgentId),
      eq(masterAgents.userId, userId)
    ),
    columns: { id: true },
  });
  if (!master) {
    return NextResponse.json({ error: "Master agent not found" }, { status: 404 });
  }
  const files = await getFileIdsAssignedToMaster(masterAgentId, userId);
  return NextResponse.json(
    files.map((f) => ({ id: f.id, filename: f.filename }))
  );
}
