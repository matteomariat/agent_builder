import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultUser } from "@/lib/db/users";
import {
  listKnowledgeItems,
  createKnowledgeItem,
} from "@/lib/db/knowledge";
import { knowledgeItemOwnerType, knowledgeItemType } from "@/lib/db/schema";

const OWNER_TYPES = knowledgeItemOwnerType as unknown as string[];
const ITEM_TYPES = knowledgeItemType as unknown as string[];

export async function GET(request: NextRequest) {
  const userId = await ensureDefaultUser();
  const { searchParams } = new URL(request.url);
  const ownerType = searchParams.get("ownerType");
  const ownerId = searchParams.get("ownerId");

  const filters: { ownerType?: "master" | "agent" | "default"; ownerId?: string | null } = {};
  if (ownerType && OWNER_TYPES.includes(ownerType)) {
    filters.ownerType = ownerType as "master" | "agent" | "default";
  }
  if (ownerId !== null && ownerId !== undefined) {
    filters.ownerId = ownerId === "" ? null : ownerId;
  }

  const items = await listKnowledgeItems(userId, filters);
  return NextResponse.json(
    items.map((i) => ({
      ...i,
      ownerId: i.ownerId ?? null,
    }))
  );
}

export async function POST(request: NextRequest) {
  const userId = await ensureDefaultUser();
  let body: {
    ownerType?: string;
    ownerId?: string | null;
    type?: string;
    content?: string;
    sortOrder?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ownerType = body.ownerType;
  const type = body.type;
  if (!ownerType || !OWNER_TYPES.includes(ownerType)) {
    return NextResponse.json(
      { error: "ownerType is required and must be master, agent, or default" },
      { status: 400 }
    );
  }
  if (!type || !ITEM_TYPES.includes(type)) {
    return NextResponse.json(
      { error: "type is required and must be guidance, rules, or style" },
      { status: 400 }
    );
  }

  const ownerId =
    ownerType === "default"
      ? null
      : body.ownerId != null && typeof body.ownerId === "string"
        ? body.ownerId.trim() || null
        : null;

  if (ownerType !== "default" && !ownerId) {
    return NextResponse.json(
      { error: "ownerId is required when ownerType is master or agent" },
      { status: 400 }
    );
  }

  const content = typeof body.content === "string" ? body.content : "";
  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? body.sortOrder
      : 0;

  const item = await createKnowledgeItem(
    userId,
    {
      ownerType: ownerType as "master" | "agent" | "default",
      ownerId,
      type: type as "guidance" | "rules" | "style",
      content,
      sortOrder,
    }
  );

  if (!item) {
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
  return NextResponse.json({
    ...item,
    ownerId: item.ownerId ?? null,
  });
}
