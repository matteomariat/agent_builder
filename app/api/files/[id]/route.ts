import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { ensureDefaultUser } from "@/lib/db/users";

const EDITABLE_EXTENSIONS = [".md", ".txt", ".csv"];
const EDITABLE_MIMES = [
  "text/markdown",
  "text/plain",
  "text/csv",
  "application/csv",
];

function isEditable(filename: string, mimeType: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  if (EDITABLE_EXTENSIONS.includes(ext)) return true;
  if (EDITABLE_MIMES.includes(mimeType?.toLowerCase?.())) return true;
  return false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await ensureDefaultUser();
  const row = await db.query.files.findFirst({
    where: and(eq(files.id, id), eq(files.userId, userId)),
  });
  if (!row) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const editable = isEditable(row.filename, row.mimeType);
  return NextResponse.json({
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    ...(editable ? { textContent: row.textContent ?? "" } : {}),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await ensureDefaultUser();
  let body: { filename?: string; textContent?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const existing = await db.query.files.findFirst({
    where: and(eq(files.id, id), eq(files.userId, userId)),
  });
  if (!existing) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const updates: { filename?: string; textContent?: string } = {};
  if (body.filename !== undefined) {
    if (typeof body.filename !== "string" || body.filename.trim() === "") {
      return NextResponse.json(
        { error: "filename cannot be empty" },
        { status: 400 }
      );
    }
    updates.filename = body.filename.trim();
  }
  if (body.textContent !== undefined) {
    if (!isEditable(existing.filename, existing.mimeType)) {
      return NextResponse.json(
        { error: "Only text/markdown/csv files can be edited" },
        { status: 400 }
      );
    }
    updates.textContent =
      typeof body.textContent === "string" ? body.textContent : "";
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(existing);
  }
  const [updated] = await db
    .update(files)
    .set(updates)
    .where(and(eq(files.id, id), eq(files.userId, userId)))
    .returning({
      id: files.id,
      filename: files.filename,
      mimeType: files.mimeType,
      createdAt: files.createdAt,
    });
  return NextResponse.json({
    ...updated,
    createdAt: updated?.createdAt?.toISOString?.() ?? updated?.createdAt,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await ensureDefaultUser();
  const result = await db
    .delete(files)
    .where(and(eq(files.id, id), eq(files.userId, userId)))
    .returning({ id: files.id });
  if (result.length === 0) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
