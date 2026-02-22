import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultUser } from "@/lib/db/users";
import {
  getKnowledgeItemById,
  updateKnowledgeItem,
  deleteKnowledgeItem,
} from "@/lib/db/knowledge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await ensureDefaultUser();
  const { id } = await params;
  const item = await getKnowledgeItemById(id, userId);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...item,
    ownerId: item.ownerId ?? null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await ensureDefaultUser();
  const { id } = await params;
  const existing = await getKnowledgeItemById(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { content?: string; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: { content?: string; sortOrder?: number } = {};
  if (body.content !== undefined) {
    updates.content =
      typeof body.content === "string" ? body.content : "";
  }
  if (
    body.sortOrder !== undefined &&
    typeof body.sortOrder === "number" &&
    Number.isFinite(body.sortOrder)
  ) {
    updates.sortOrder = body.sortOrder;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      ...existing,
      ownerId: existing.ownerId ?? null,
    });
  }

  const item = await updateKnowledgeItem(id, userId, updates);
  if (!item) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json({
    ...item,
    ownerId: item.ownerId ?? null,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await ensureDefaultUser();
  const { id } = await params;
  const existing = await getKnowledgeItemById(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await deleteKnowledgeItem(id, userId);
  return new NextResponse(null, { status: 204 });
}
