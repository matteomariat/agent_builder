import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultUser } from "@/lib/db/users";
import {
  getAssignmentsForFile,
  setAssignmentsForFile,
} from "@/lib/db/file-assignments";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await ensureDefaultUser();
  const { id: fileId } = await params;
  const assignments = await getAssignmentsForFile(fileId, userId);
  if (assignments === null) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return NextResponse.json({ assignments });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await ensureDefaultUser();
  const { id: fileId } = await params;
  let body: {
    assignments?: Array<{ assigneeType: string; assigneeId: string }>;
    masterIds?: string[];
    agentIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let list: Array<{ assigneeType: "master" | "agent"; assigneeId: string }>;
  if (Array.isArray(body.assignments)) {
    list = body.assignments
      .filter(
        (a): a is { assigneeType: string; assigneeId: string } =>
          a && typeof a.assigneeType === "string" && typeof a.assigneeId === "string"
      )
      .map((a) => ({
        assigneeType: a.assigneeType as "master" | "agent",
        assigneeId: a.assigneeId,
      }))
      .filter((a) => a.assigneeType === "master" || a.assigneeType === "agent");
  } else if (body.masterIds !== undefined || body.agentIds !== undefined) {
    const masterIds = Array.isArray(body.masterIds)
      ? body.masterIds.filter((id): id is string => typeof id === "string")
      : [];
    const agentIds = Array.isArray(body.agentIds)
      ? body.agentIds.filter((id): id is string => typeof id === "string")
      : [];
    list = [
      ...masterIds.map((assigneeId) => ({ assigneeType: "master" as const, assigneeId })),
      ...agentIds.map((assigneeId) => ({ assigneeType: "agent" as const, assigneeId })),
    ];
  } else {
    list = [];
  }

  const ok = await setAssignmentsForFile(fileId, userId, list);
  if (!ok) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const updated = await getAssignmentsForFile(fileId, userId);
  return NextResponse.json({ assignments: updated ?? [] });
}
