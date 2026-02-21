"use client";

import dynamic from "next/dynamic";
import LockBadge from "./LockBadge";
import { useAppStore } from "@/lib/store/useAppStore";

// TipTap requires browser APIs, load client-only
const Editor = dynamic(() => import("./Editor"), { ssr: false });

export default function DocumentPane() {
  const documentContent = useAppStore((s) => s.documentContent);

  const copyToClipboard = () => {
    const div = document.createElement("div");
    div.innerHTML = documentContent;
    navigator.clipboard.writeText(div.textContent || "");
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100 flex-shrink-0">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
          Working Document
        </span>
        <div className="flex items-center gap-2">
          <LockBadge />
          <button
            onClick={copyToClipboard}
            className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1 rounded hover:bg-zinc-50"
            title="Copy as plain text"
          >
            Copy
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <Editor />
      </div>
    </div>
  );
}
