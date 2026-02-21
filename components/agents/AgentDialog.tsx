"use client";

import { useState } from "react";
import { useAppStore, AgentConfig } from "@/lib/store/useAppStore";

const MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (fast)" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (capable)" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (balanced)" },
];

interface AgentDialogProps {
  existing?: AgentConfig;
  onClose: () => void;
}

export default function AgentDialog({ existing, onClose }: AgentDialogProps) {
  const addAgent = useAppStore((s) => s.addAgent);
  const updateAgent = useAppStore((s) => s.updateAgent);
  const agents = useAppStore((s) => s.agents);

  const [name, setName] = useState(existing?.name ?? "");
  const [systemPrompt, setSystemPrompt] = useState(
    existing?.systemPrompt ?? "You are a helpful AI assistant."
  );
  const [modelId, setModelId] = useState(
    existing?.modelId ?? "gemini-2.0-flash"
  );
  const [isMaster, setIsMaster] = useState(existing?.isMaster ?? false);

  const hasMaster = agents.some((a) => a.isMaster && a.id !== existing?.id);

  const handleSave = () => {
    if (!name.trim()) return;

    if (existing) {
      updateAgent(existing.id, { name, systemPrompt, modelId, isMaster });
    } else {
      addAgent({
        id: crypto.randomUUID(),
        name: name.trim(),
        systemPrompt,
        modelId,
        isMaster,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-zinc-800">
            {existing ? "Edit Agent" : "Create Agent"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Research Agent"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Model
            </label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-master"
              checked={isMaster}
              onChange={(e) => setIsMaster(e.target.checked)}
              disabled={hasMaster && !existing?.isMaster}
              className="rounded"
            />
            <label htmlFor="is-master" className="text-xs text-zinc-600">
              Master agent{" "}
              {hasMaster && !existing?.isMaster && (
                <span className="text-zinc-400">(a master already exists)</span>
              )}
            </label>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {existing ? "Save" : "Create"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
