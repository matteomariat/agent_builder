"use client";

import { useCallback, useEffect, useState } from "react";

type AgentRecord = {
  id: string;
  name: string;
  systemPrompt: string;
  model: string | null;
  createdAt: string;
};

const MODELS = [
  { value: "", label: "Default (Gemini 2.5 Flash)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (legacy)" },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editModel, setEditModel] = useState("");

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to load agents");
      const data = await res.json();
      setAgents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !systemPrompt.trim()) {
        setError("Name and system prompt are required");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            systemPrompt: systemPrompt.trim(),
            model: model.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create agent");
        }
        setName("");
        setSystemPrompt("");
        setModel("");
        await fetchAgents();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create agent");
      } finally {
        setSubmitting(false);
      }
    },
    [name, systemPrompt, model, fetchAgents]
  );

  const startEdit = useCallback((a: AgentRecord) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditSystemPrompt(a.systemPrompt);
    setEditModel(a.model ?? "");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleUpdate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingId || !editName.trim() || !editSystemPrompt.trim()) return;
      setError(null);
      try {
        const res = await fetch(`/api/agents/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            systemPrompt: editSystemPrompt.trim(),
            model: editModel.trim() || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update agent");
        }
        setEditingId(null);
        await fetchAgents();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update agent");
      }
    },
    [editingId, editName, editSystemPrompt, editModel, fetchAgents]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this agent?")) return;
      setError(null);
      try {
        const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        if (editingId === id) setEditingId(null);
        await fetchAgents();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete agent");
      }
    },
    [fetchAgents, editingId]
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Agents
      </h1>
      <p className="mb-8 text-zinc-600 dark:text-zinc-400">
        Create agents with a name and system prompt. The Master agent can
        delegate to them.
      </p>

      <form
        onSubmit={handleCreate}
        className="mb-10 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          New agent
        </h2>
        <div className="mb-4">
          <label
            htmlFor="agent-name"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Name
          </label>
          <input
            id="agent-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Researcher"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="agent-prompt"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            System prompt
          </label>
          <textarea
            id="agent-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Instructions for this agent..."
            rows={4}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="agent-model"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Model (optional)
          </label>
          <select
            id="agent-model"
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
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {submitting ? "Creating…" : "Create agent"}
        </button>
      </form>

      {error && (
        <div
          className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading agents…</p>
      ) : agents.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          No agents yet. Create one above.
        </p>
      ) : (
        <ul className="space-y-4">
          {agents.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {editingId === a.id ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Name"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <textarea
                    value={editSystemPrompt}
                    onChange={(e) => setEditSystemPrompt(e.target.value)}
                    placeholder="System prompt"
                    rows={3}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <select
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                        {a.name}
                      </h3>
                      {a.model && (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Model: {a.model}
                        </p>
                      )}
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {a.systemPrompt}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(a)}
                        className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
