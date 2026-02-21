"use client";

import { useAppStore } from "@/lib/store/useAppStore";

const STATUS_CONFIG = {
  running: { dot: "bg-amber-400 animate-pulse", label: "Running", text: "text-amber-700 bg-amber-50" },
  done: { dot: "bg-green-400", label: "Done", text: "text-green-700 bg-green-50" },
  error: { dot: "bg-red-400", label: "Error", text: "text-red-700 bg-red-50" },
};

export default function SubagentFeed() {
  const subagentTasks = useAppStore((s) => s.subagentTasks);

  if (subagentTasks.length === 0) return null;

  return (
    <div className="border-t border-zinc-100 px-3 py-2 space-y-2 flex-shrink-0 max-h-48 overflow-y-auto">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
        Subagent Activity
      </p>
      {subagentTasks.map((task) => {
        const cfg = STATUS_CONFIG[task.status];
        return (
          <div key={task.id} className="flex items-start gap-2">
            <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-zinc-600">
                  {task.agentName}
                </span>
                <span className={`text-xs px-1 rounded ${cfg.text}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-xs text-zinc-500 truncate">{task.task}</p>
              {task.status === "done" && task.result && (
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                  {task.result}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
