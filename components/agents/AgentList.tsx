"use client";

import { useState } from "react";
import { useAppStore, AgentConfig } from "@/lib/store/useAppStore";
import AgentDialog from "./AgentDialog";

interface AgentListProps {
  onAdd: () => void;
}

export default function AgentList({ onAdd }: AgentListProps) {
  const agents = useAppStore((s) => s.agents);
  const removeAgent = useAppStore((s) => s.removeAgent);
  const [editing, setEditing] = useState<AgentConfig | null>(null);

  return (
    <div>
      {agents.length === 0 ? (
        <p className="text-xs text-zinc-400 mb-3">
          No agents yet. Create a master agent to get started.
        </p>
      ) : (
        <div className="space-y-2 mb-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-200"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-700 truncate">
                    {agent.name}
                  </span>
                  {agent.isMaster && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                      Master
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 truncate">{agent.modelId}</p>
              </div>
              <button
                onClick={() => setEditing(agent)}
                className="text-xs text-zinc-500 hover:text-zinc-700 px-2"
              >
                Edit
              </button>
              <button
                onClick={() => removeAgent(agent.id)}
                className="text-xs text-red-400 hover:text-red-600 px-2"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
      >
        <span>+</span> Add Agent
      </button>

      {editing && (
        <AgentDialog existing={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
