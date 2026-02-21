import { NextRequest, NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/utils/file-extraction";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const fileEntries = formData.getAll("files") as File[];

    if (fileEntries.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const results = await Promise.all(
      fileEntries.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const content = await extractTextFromFile(buffer, file.name, file.type);

        return {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type || "text/plain",
          content,
        };
      })
    );

    return NextResponse.json(results);
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Failed to process files" },
      { status: 500 }
    );
  }
}
