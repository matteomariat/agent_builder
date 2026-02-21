"use client";

import { useAppStore } from "@/lib/store/useAppStore";

const EXT_ICONS: Record<string, string> = {
  pdf: "📄",
  md: "📝",
  csv: "📊",
  txt: "📃",
};

function getIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_ICONS[ext] ?? "📎";
}

export default function FileList() {
  const files = useAppStore((s) => s.files);
  const removeFile = useAppStore((s) => s.removeFile);

  if (files.length === 0) {
    return <p className="text-xs text-zinc-400">No files uploaded yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 rounded-full text-xs text-zinc-700"
        >
          <span>{getIcon(file.name)}</span>
          <span className="max-w-[120px] truncate">{file.name}</span>
          <button
            onClick={() => removeFile(file.id)}
            className="ml-1 text-zinc-400 hover:text-zinc-600"
            aria-label="Remove file"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
