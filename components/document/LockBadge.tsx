"use client";

import { useAppStore } from "@/lib/store/useAppStore";

const LOCK_CONFIG = {
  idle: {
    dot: "bg-green-400",
    text: "Ready",
    bg: "bg-green-50 text-green-700 border-green-200",
  },
  user: {
    dot: "bg-blue-400",
    text: "You are editing",
    bg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  agent: {
    dot: "bg-amber-400 animate-pulse",
    text: "Agent is writing…",
    bg: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

export default function LockBadge() {
  const { documentLock, documentLockHolder } = useAppStore((s) => ({
    documentLock: s.documentLock,
    documentLockHolder: s.documentLockHolder,
  }));

  const config = LOCK_CONFIG[documentLock];

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${config.bg}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span>
        {documentLockHolder && documentLock === "agent"
          ? `${documentLockHolder} is writing…`
          : config.text}
      </span>
    </div>
  );
}
