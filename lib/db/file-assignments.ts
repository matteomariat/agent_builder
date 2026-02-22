import { db } from "./index";
import { fileAssignments, files, agents, masterAgents } from "./schema";
import { eq, and, inArray } from "drizzle-orm";

export type Assignee = { assigneeType: "master" | "agent"; assigneeId: string };

export async function getAssignmentsForFile(fileId: string, userId: string) {
  const fileRow = await db.query.files.findFirst({
    where: and(eq(files.id, fileId), eq(files.userId, userId)),
    columns: { id: true },
  });
  if (!fileRow) return null;

  const rows = await db.query.fileAssignments.findMany({
    where: eq(fileAssignments.fileId, fileId),
  });
  return rows.map((r) => ({
    assigneeType: r.assigneeType,
    assigneeId: r.assigneeId,
    role: r.role ?? null,
  }));
}

export async function setAssignmentsForFile(
  fileId: string,
  userId: string,
  assignments: Assignee[]
) {
  const fileRow = await db.query.files.findFirst({
    where: and(eq(files.id, fileId), eq(files.userId, userId)),
    columns: { id: true },
  });
  if (!fileRow) return false;

  await db.delete(fileAssignments).where(eq(fileAssignments.fileId, fileId));

  const valid = assignments.filter(
    (a) =>
      (a.assigneeType === "master" || a.assigneeType === "agent") &&
      typeof a.assigneeId === "string" &&
      a.assigneeId.trim() !== ""
  );
  const unique = Array.from(
    new Map(valid.map((a) => [`${a.assigneeType}:${a.assigneeId}`, a])).values()
  );

  if (unique.length > 0) {
    await db.insert(fileAssignments).values(
      unique.map((a) => ({
        fileId,
        assigneeType: a.assigneeType,
        assigneeId: a.assigneeId,
        role: "rag" as const,
      }))
    );
  }
  return true;
}

export async function getFileIdsAssignedToAgent(agentId: string, userId: string) {
  const rows = await db.query.fileAssignments.findMany({
    where: and(
      eq(fileAssignments.assigneeType, "agent"),
      eq(fileAssignments.assigneeId, agentId)
    ),
    columns: { fileId: true },
  });
  const fileIds = rows.map((r) => r.fileId);
  if (fileIds.length === 0) return [];

  const userFiles = await db.query.files.findMany({
    where: and(eq(files.userId, userId), inArray(files.id, fileIds)),
    columns: { id: true, filename: true },
  });
  return userFiles;
}

export async function getFileIdsAssignedToMaster(masterAgentId: string, userId: string) {
  const rows = await db.query.fileAssignments.findMany({
    where: and(
      eq(fileAssignments.assigneeType, "master"),
      eq(fileAssignments.assigneeId, masterAgentId)
    ),
    columns: { fileId: true },
  });
  const fileIds = rows.map((r) => r.fileId);
  if (fileIds.length === 0) return [];

  const userFiles = await db.query.files.findMany({
    where: and(eq(files.userId, userId), inArray(files.id, fileIds)),
    columns: { id: true, filename: true },
  });
  return userFiles;
}

export async function getAssignedFileIdsForMaster(masterAgentId: string): Promise<string[]> {
  const rows = await db.query.fileAssignments.findMany({
    where: and(
      eq(fileAssignments.assigneeType, "master"),
      eq(fileAssignments.assigneeId, masterAgentId)
    ),
    columns: { fileId: true },
  });
  return rows.map((r) => r.fileId);
}

/** Set which files are assigned to an agent. Replaces all existing assignments for this agent. */
export async function setFileAssignmentsForAgent(
  agentId: string,
  userId: string,
  fileIds: string[]
): Promise<boolean> {
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.userId, userId)),
    columns: { id: true },
  });
  if (!agent) return false;
  await db
    .delete(fileAssignments)
    .where(
      and(
        eq(fileAssignments.assigneeType, "agent"),
        eq(fileAssignments.assigneeId, agentId)
      )
    );
  const validFileIds = fileIds.filter((id) => typeof id === "string" && id.trim() !== "");
  if (validFileIds.length === 0) return true;
  const userFiles = await db.query.files.findMany({
    where: and(eq(files.userId, userId), inArray(files.id, validFileIds)),
    columns: { id: true },
  });
  const idsToAssign = userFiles.map((f) => f.id);
  if (idsToAssign.length > 0) {
    await db.insert(fileAssignments).values(
      idsToAssign.map((fileId) => ({
        fileId,
        assigneeType: "agent" as const,
        assigneeId: agentId,
        role: "rag" as const,
      }))
    );
  }
  return true;
}

/** Set which files are assigned to a master agent. Replaces all existing assignments for this master. */
export async function setFileAssignmentsForMaster(
  masterAgentId: string,
  userId: string,
  fileIds: string[]
): Promise<boolean> {
  const master = await db.query.masterAgents.findFirst({
    where: and(
      eq(masterAgents.id, masterAgentId),
      eq(masterAgents.userId, userId)
    ),
    columns: { id: true },
  });
  if (!master) return false;
  await db
    .delete(fileAssignments)
    .where(
      and(
        eq(fileAssignments.assigneeType, "master"),
        eq(fileAssignments.assigneeId, masterAgentId)
      )
    );
  const validFileIds = fileIds.filter((id) => typeof id === "string" && id.trim() !== "");
  if (validFileIds.length === 0) return true;
  const userFiles = await db.query.files.findMany({
    where: and(eq(files.userId, userId), inArray(files.id, validFileIds)),
    columns: { id: true },
  });
  const idsToAssign = userFiles.map((f) => f.id);
  if (idsToAssign.length > 0) {
    await db.insert(fileAssignments).values(
      idsToAssign.map((fileId) => ({
        fileId,
        assigneeType: "master" as const,
        assigneeId: masterAgentId,
        role: "rag" as const,
      }))
    );
  }
  return true;
}
