import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { ensureDefaultUser } from "@/lib/db/users";
import { extractTextFromPdf } from "@/lib/pdf";

const ALLOWED_EXTENSIONS = [".md", ".csv", ".txt", ".pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

async function uploadToStorage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const key = `${randomUUID()}-${filename}`;
  if (token) {
    const blob = await put(key, buffer, {
      access: "public",
      contentType,
    });
    return blob.url;
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filePath = path.join(UPLOAD_DIR, key);
  await writeFile(filePath, buffer);
  return filePath;
}

async function extractText(
  buffer: Buffer,
  ext: string,
  mimeType: string
): Promise<string | null> {
  if (ext === ".pdf" || mimeType === "application/pdf") {
    try {
      return await extractTextFromPdf(buffer);
    } catch {
      return null;
    }
  }
  if ([".md", ".txt", ".csv"].includes(ext)) {
    return buffer.toString("utf-8");
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await ensureDefaultUser();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid file" },
        { status: 400 }
      );
    }
    const filename = file.name;
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Allowed types: .md, .csv, .txt, .pdf" },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = await uploadToStorage(
      buffer,
      filename,
      file.type || "application/octet-stream"
    );
    const textContent = await extractText(buffer, ext, file.type || "");
    const id = randomUUID();
    await db.insert(files).values({
      id,
      userId,
      filename,
      mimeType: file.type || "application/octet-stream",
      storageKey,
      textContent,
      createdAt: new Date(),
    });
    return NextResponse.json({
      id,
      filename,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
