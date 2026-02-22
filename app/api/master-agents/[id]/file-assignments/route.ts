import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultUser } from "@/lib/db/users";
import { setFileAssignmentsForMaster } from "@/lib/db/file-assignments";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await ensureDefaultUser();
  const { id: masterAgentId } = await params;
  let body: { fileIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const fileIds = Array.isArray(body.fileIds)
    ? body.fileIds.filter((id): id is string => typeof id === "string")
    : [];
  const ok = await setFileAssignmentsForMaster(masterAgentId, userId, fileIds);
  if (!ok) {
    return NextResponse.json({ error: "Master agent not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, fileIds: fileIds.length });
}
