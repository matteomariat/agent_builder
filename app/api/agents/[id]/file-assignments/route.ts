import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultUser } from "@/lib/db/users";
import { setFileAssignmentsForAgent } from "@/lib/db/file-assignments";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await ensureDefaultUser();
  const { id: agentId } = await params;
  let body: { fileIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const fileIds = Array.isArray(body.fileIds)
    ? body.fileIds.filter((id): id is string => typeof id === "string")
    : [];
  const ok = await setFileAssignmentsForAgent(agentId, userId, fileIds);
  if (!ok) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, fileIds: fileIds.length });
}
