import { put, del } from "@vercel/blob";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const blob = await put(`${randomUUID()}-${filename}`, buffer, {
      access: "public",
      contentType,
    });
    return blob.url;
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const key = `${randomUUID()}-${filename}`;
  const filePath = path.join(UPLOAD_DIR, key);
  await writeFile(filePath, buffer);
  return filePath;
}

export async function deleteFile(storageKey: string): Promise<void> {
  if (storageKey.startsWith("http")) {
    await del(storageKey);
    return;
  }
  try {
    await unlink(storageKey);
  } catch {
    // ignore if file already removed
  }
}
