"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (default)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (legacy)" },
];

type MasterAgentDetail = {
  id: string;
  name: string;
  systemPrompt: string;
  model: string | null;
  maxSteps: number;
  thinkingEnabled: boolean;
  toolIds: string[];
  subAgentIds: string[];
  updatedAt: string | null;
};

type ToolOption = { id: string; name: string };
type FileOption = { id: string; filename: string };
type AgentOption = { id: string; name: string };

export default function MasterEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [knowledgeGuidance, setKnowledgeGuidance] = useState("");
  const [knowledgeRules, setKnowledgeRules] = useState("");
  const [knowledgeStyle, setKnowledgeStyle] = useState("");
  const [useDefaultGuidance, setUseDefaultGuidance] = useState(true);
  const [useDefaultRules, setUseDefaultRules] = useState(true);
  const [useDefaultStyle, setUseDefaultStyle] = useState(true);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [availableFiles, setAvailableFiles] = useState<FileOption[]>([]);
  const [model, setModel] = useState("gemini-2.5-flash");
  const [maxSteps, setMaxSteps] = useState(10);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [availableTools, setAvailableTools] = useState<ToolOption[]>([]);
  const [subAgentIds, setSubAgentIds] = useState<string[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AgentOption[]>([]);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch("/api/tools");
      if (res.ok) {
        const data = await res.json();
        setAvailableTools(data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/master-agents/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.replace("/agents");
          return;
        }
        throw new Error("Failed to load project type");
      }
      const data: MasterAgentDetail = await res.json();
      setName(data.name ?? "");
      setSystemPrompt(data.systemPrompt ?? "");
      setModel(data.model ?? "gemini-2.5-flash");
      setMaxSteps(
        typeof data.maxSteps === "number" && Number.isFinite(data.maxSteps)
          ? data.maxSteps
          : 10
      );
      setThinkingEnabled(Boolean(data.thinkingEnabled));
      setToolIds(Array.isArray(data.toolIds) ? data.toolIds : []);
      setSubAgentIds(Array.isArray(data.subAgentIds) ? data.subAgentIds : []);
      const [knowledgeRes, filesRes] = await Promise.all([
        fetch(`/api/knowledge?ownerType=master&ownerId=${encodeURIComponent(id)}`),
        fetch(`/api/master-agents/${id}/assigned-files`),
      ]);
      if (knowledgeRes.ok) {
        const items: { type: string; content: string }[] = await knowledgeRes.json();
        const byType: Record<string, string[]> = { guidance: [], rules: [], style: [] };
        for (const item of items) {
          if (item.type in byType && (item.content ?? "").trim()) {
            byType[item.type as keyof typeof byType].push((item.content ?? "").trim());
          }
        }
        setKnowledgeGuidance(byType.guidance.join("\n\n"));
        setUseDefaultGuidance(byType.guidance.length === 0);
        setKnowledgeRules(byType.rules.join("\n\n"));
        setUseDefaultRules(byType.rules.length === 0);
        setKnowledgeStyle(byType.style.join("\n\n"));
        setUseDefaultStyle(byType.style.length === 0);
      }
      if (filesRes.ok) {
        const filesList: { id: string; filename: string }[] = await filesRes.json();
        setSelectedFileIds(filesList.map((f) => f.id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAvailableAgents(Array.isArray(data) ? data.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })) : []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/files");
      if (res.ok) {
        const data = await res.json();
        setAvailableFiles(Array.isArray(data) ? data.map((f: { id: string; filename: string }) => ({ id: f.id, filename: f.filename })) : []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/master-agents/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim() || "Default",
            systemPrompt: systemPrompt.trim(),
            model: model.trim() || null,
            maxSteps: maxSteps >= 1 && maxSteps <= 100 ? maxSteps : 10,
            thinkingEnabled,
            toolIds,
            subAgentIds,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update");
        }
        const listRes = await fetch(`/api/knowledge?ownerType=master&ownerId=${encodeURIComponent(id)}`);
        if (listRes.ok) {
          const items: { id: string }[] = await listRes.json();
          for (const item of items) {
            await fetch(`/api/knowledge/${item.id}`, { method: "DELETE" });
          }
        }
        for (const { type, useDefault, content } of [
          { type: "guidance" as const, useDefault: useDefaultGuidance, content: knowledgeGuidance },
          { type: "rules" as const, useDefault: useDefaultRules, content: knowledgeRules },
          { type: "style" as const, useDefault: useDefaultStyle, content: knowledgeStyle },
        ]) {
          if (!useDefault && content.trim()) {
            await fetch("/api/knowledge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ownerType: "master",
                ownerId: id,
                type,
                content: content.trim(),
              }),
            });
          }
        }
        await fetch(`/api/master-agents/${id}/file-assignments`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds: selectedFileIds }),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setSubmitting(false);
      }
    },
    [id, name, systemPrompt, knowledgeGuidance, knowledgeRules, knowledgeStyle, useDefaultGuidance, useDefaultRules, useDefaultStyle, selectedFileIds, model, maxSteps, thinkingEnabled, toolIds, subAgentIds]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/agents" className="hover:text-zinc-700 dark:hover:text-zinc-300">
          Agents
        </Link>
        <span aria-hidden>/</span>
        <span>{name || "Edit"}</span>
      </div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Edit project type
      </h1>

      {error && (
        <div
          className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mb-4">
          <label
            htmlFor="master-name"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Name
          </label>
          <input
            id="master-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Default, Product manager"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="master-prompt"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            System prompt
          </label>
          <textarea
            id="master-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Instructions for this project type..."
            rows={6}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
        </div>
        <div className="mb-4 space-y-3">
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Knowledge (optional)
          </span>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <input
                id="master-edit-use-default-guidance"
                type="checkbox"
                checked={useDefaultGuidance}
                onChange={(e) => setUseDefaultGuidance(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <label htmlFor="master-edit-use-default-guidance" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
            </div>
            <textarea
              value={knowledgeGuidance}
              onChange={(e) => setKnowledgeGuidance(e.target.value)}
              placeholder="Guidance"
              rows={2}
              disabled={useDefaultGuidance}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <input
                id="master-edit-use-default-rules"
                type="checkbox"
                checked={useDefaultRules}
                onChange={(e) => setUseDefaultRules(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <label htmlFor="master-edit-use-default-rules" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
            </div>
            <textarea
              value={knowledgeRules}
              onChange={(e) => setKnowledgeRules(e.target.value)}
              placeholder="Rules"
              rows={2}
              disabled={useDefaultRules}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <input
                id="master-edit-use-default-style"
                type="checkbox"
                checked={useDefaultStyle}
                onChange={(e) => setUseDefaultStyle(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <label htmlFor="master-edit-use-default-style" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
            </div>
            <textarea
              value={knowledgeStyle}
              onChange={(e) => setKnowledgeStyle(e.target.value)}
              placeholder="Style"
              rows={2}
              disabled={useDefaultStyle}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div className="mt-3">
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Knowledge files (RAG)
            </label>
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              Select files this project type can use in the research tool. You can also assign from <Link href="/files" className="underline">Files</Link>.
            </p>
            {availableFiles.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                No files yet. Upload in <Link href="/files" className="underline">Files</Link>.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-800">
                {availableFiles.map((f) => (
                  <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700">
                    <input
                      type="checkbox"
                      checked={selectedFileIds.includes(f.id)}
                      onChange={(e) =>
                        setSelectedFileIds((prev) =>
                          e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id)
                        )
                      }
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                    />
                    <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">{f.filename}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mb-4">
          <label
            htmlFor="master-model"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Model
          </label>
          <select
            id="master-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label
            htmlFor="master-max-steps"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Max steps (1–100)
          </label>
          <input
            id="master-max-steps"
            type="number"
            min={1}
            max={100}
            value={maxSteps}
            onChange={(e) => setMaxSteps(Number(e.target.value) || 10)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div className="mb-6 flex items-center gap-2">
          <input
            id="master-thinking"
            type="checkbox"
            checked={thinkingEnabled}
            onChange={(e) => setThinkingEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <label
            htmlFor="master-thinking"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Enable extended thinking
          </label>
        </div>
        {availableTools.length > 0 && (
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Assigned tools (in addition to built-in: invoke_agent, write_to_doc, research)
            </label>
            <div className="flex flex-wrap gap-3">
              {availableTools.map((tool) => (
                <label
                  key={tool.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={toolIds.includes(tool.id)}
                    onChange={(e) =>
                      setToolIds((prev) =>
                        e.target.checked
                          ? [...prev, tool.id]
                          : prev.filter((id) => id !== tool.id)
                      )
                    }
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">{tool.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Sub-agents
          </label>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Agents this master can invoke. Only these will appear in its context. Leave empty to allow all agents.
          </p>
          {availableAgents.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {availableAgents.map((agent) => (
                <label
                  key={agent.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={subAgentIds.includes(agent.id)}
                    onChange={(e) =>
                      setSubAgentIds((prev) =>
                        e.target.checked
                          ? [...prev, agent.id]
                          : prev.filter((id) => id !== agent.id)
                      )
                    }
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">{agent.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
              No agents yet. Create sub-agents in <Link href="/agents" className="underline">Agents</Link>, then assign them here.
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
          <Link
            href="/agents"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Back to list
          </Link>
        </div>
      </form>
    </div>
  );
}
