"use client";

import { useCallback, useEffect, useState } from "react";

type FileRecord = {
  id: string;
  filename: string;
  mimeType: string;
  createdAt: string;
};

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/files");
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();
      setFiles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (![".md", ".csv", ".txt", ".pdf"].includes(ext)) {
        setError("Allowed types: .md, .csv, .txt, .pdf");
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Upload failed");
        }
        await fetchFiles();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [fetchFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Files
      </h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">
        Upload .md, .csv, .txt, or .pdf files. They can be used by agents for
        research.
      </p>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`mb-8 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? "border-zinc-400 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        <input
          type="file"
          id="file-upload"
          accept=".md,.csv,.txt,.pdf"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <label
          htmlFor="file-upload"
          className="flex cursor-pointer flex-col items-center gap-2 sm:flex-row sm:justify-center"
        >
          <span className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            {uploading ? "Uploading…" : "Choose file"}
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            or drag and drop
          </span>
        </label>
      </div>

      {error && (
        <div
          className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading files…</p>
      ) : files.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          No files yet. Upload one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {f.filename}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {new Date(f.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
