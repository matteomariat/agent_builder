"use client";

import { useRef, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { UploadedFile } from "@/lib/store/useAppStore";

const ACCEPTED = ".md,.csv,.txt,.pdf";

interface FileUploadZoneProps {
  onClose?: () => void;
}

export default function FileUploadZone({ onClose }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addFiles = useAppStore((s) => s.addFiles);

  const upload = useCallback(
    async (fileList: FileList) => {
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        Array.from(fileList).forEach((f) => formData.append("files", f));

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error(await res.text());

        const uploaded: UploadedFile[] = await res.json();
        addFiles(uploaded);
        if (onClose) onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [addFiles, onClose]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) upload(e.dataTransfer.files);
    },
    [upload]
  );

  return (
    <div className="mt-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed cursor-pointer transition-colors
          ${dragging ? "border-blue-400 bg-blue-50" : "border-zinc-300 hover:border-zinc-400 bg-zinc-50"}
        `}
      >
        <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="text-xs text-zinc-500">
          {uploading ? "Uploading…" : "Drop files here or click to browse"}
        </p>
        <p className="text-xs text-zinc-400">PDF, MD, CSV, TXT</p>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && upload(e.target.files)}
      />
    </div>
  );
}
