import { NextRequest, NextResponse } from "next/server";
import { suggestTool } from "@/lib/agents/suggest-tool";

export async function POST(request: NextRequest) {
  let body: { userInput?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const userInput =
    typeof body.userInput === "string" ? body.userInput.trim() : "";
  if (!userInput) {
    return NextResponse.json(
      { error: "userInput is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  const result = await suggestTool(userInput);
  if (!result) {
    return NextResponse.json(
      { error: "Could not generate a tool suggestion. Try a more specific description." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    name: result.name,
    description: result.description,
    url: result.url,
    method: result.method,
    headers: result.headers ?? undefined,
    inputSchema: result.inputSchema,
  });
}
