"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResourcePageLayout,
  ResourceActionBar,
  ResourceCard,
  ResourceRow,
  EmptyState,
  DropdownMenu,
  Modal,
} from "@/app/(main)/components/resource-list";

const VIEW_MODE_KEY = "resource-view-tools";

type ToolRecord = {
  id: string;
  name: string;
  description: string;
  type: string;
  config: string;
};

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const DEFAULT_INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: { type: "string", description: "Search or input parameter" },
  },
  required: [] as string[],
};

// Serpstack: https://serpstack.com/documentation — access_key, query (required), num (default 10), location (optional, free-text or Locations API canonical_name)
const SERPSTACK_TEMPLATE = {
  name: "serpstack_search",
  description:
    "Search the web via Serpstack (Google SERP). Returns the first 10 organic results. Optionally specify a country/location for localized results.",
  url: "https://api.serpstack.com/search?access_key=cd3f7f9ec2f0acf3ae44e32365e49734&num=10",
  method: "GET" as const,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query.",
      },
      location: {
        type: "string",
        description:
          "Country or geographic location for the search. Use free-text (e.g. 'United States', 'France') or a canonical_name from the Serpstack Locations API for the full list of supported countries (see https://serpstack.com/documentation#locations_request). Optional.",
      },
    },
    required: ["query"],
  },
};

const FETCH_WEBSITE_TEMPLATE = {
  name: "fetch_website",
  description:
    "Fetches a webpage by URL and returns a simplified markdown version of its content.",
  url: "",
  method: "POST" as const,
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Full URL of the page to fetch (e.g. https://example.com/page).",
      },
    },
    required: ["url"],
  },
};

export default function ToolsPage() {
  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [inputSchemaJson, setInputSchemaJson] = useState(
    JSON.stringify(DEFAULT_INPUT_SCHEMA, null, 2)
  );
  const [headersJson, setHeadersJson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editMethod, setEditMethod] = useState("GET");
  const [editInputSchemaJson, setEditInputSchemaJson] = useState(
    JSON.stringify(DEFAULT_INPUT_SCHEMA, null, 2)
  );
  const [editHeadersJson, setEditHeadersJson] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === "list" || stored === "cards") setViewMode(stored);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const fetchTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tools");
      if (!res.ok) throw new Error("Failed to load tools");
      const data = await res.json();
      setTools(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading tools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const handleCreate = useCallback(
    async (e: React.FormEvent, onSuccess?: () => void) => {
      e.preventDefault();
      if (!name.trim() || !description.trim()) {
        setError("Name and description are required");
        return;
      }
      let inputSchema: object;
      try {
        inputSchema = JSON.parse(inputSchemaJson);
      } catch {
        setError("Input schema must be valid JSON");
        return;
      }
      if (!url.trim()) {
        setError("URL is required for API tools");
        return;
      }
      let headers: Record<string, string> | undefined;
      if (headersJson.trim()) {
        try {
          const parsed = JSON.parse(headersJson) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            headers = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === "string") headers[k] = v;
            }
            if (Object.keys(headers).length === 0) headers = undefined;
          }
        } catch {
          setError("Headers must be valid JSON (e.g. {\"Authorization\": \"Bearer key\"})");
          return;
        }
      }
      setSubmitting(true);
      setError(null);
      try {
        const config: { url: string; method: string; inputSchema: object; headers?: Record<string, string> } = {
          url: url.trim(),
          method,
          inputSchema,
        };
        if (headers) config.headers = headers;
        const res = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            type: "api",
            config,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create tool");
        }
        setName("");
        setDescription("");
        setUrl("");
        setMethod("GET");
        setInputSchemaJson(JSON.stringify(DEFAULT_INPUT_SCHEMA, null, 2));
        setHeadersJson("");
        await fetchTools();
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create tool");
      } finally {
        setSubmitting(false);
      }
    },
    [name, description, url, method, inputSchemaJson, headersJson, fetchTools]
  );

  const handleCreateSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleCreate(e, () => setCreateModalOpen(false));
    },
    [handleCreate]
  );

  const handleAiFill = useCallback(async () => {
    const trimmed = aiPrompt.trim();
    if (!trimmed || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/tools/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(typeof data.error === "string" ? data.error : "Could not fill form");
        return;
      }
      setName(data.name ?? "");
      setDescription(data.description ?? "");
      setUrl(data.url ?? "");
      setMethod(data.method ?? "GET");
      setInputSchemaJson(
        data.inputSchema
          ? JSON.stringify(data.inputSchema, null, 2)
          : JSON.stringify(DEFAULT_INPUT_SCHEMA, null, 2)
      );
      setHeadersJson(
        data.headers && Object.keys(data.headers).length > 0
          ? JSON.stringify(data.headers, null, 2)
          : ""
      );
      setAiError(null);
    } catch {
      setAiError("Request failed. Try again.");
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, aiLoading]);

  const startEdit = useCallback((t: ToolRecord) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditDescription(t.description);
    try {
      const config = JSON.parse(t.config) as {
        url?: string;
        method?: string;
        inputSchema?: object;
        headers?: Record<string, string>;
      };
      setEditUrl(config.url ?? "");
      setEditMethod(config.method ?? "GET");
      setEditInputSchemaJson(
        JSON.stringify(config.inputSchema ?? DEFAULT_INPUT_SCHEMA, null, 2)
      );
      setEditHeadersJson(
        config.headers && Object.keys(config.headers).length > 0
          ? JSON.stringify(config.headers, null, 2)
          : ""
      );
    } catch {
      setEditUrl("");
      setEditMethod("GET");
      setEditInputSchemaJson(JSON.stringify(DEFAULT_INPUT_SCHEMA, null, 2));
      setEditHeadersJson("");
    }
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleUpdate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingId || !editName.trim() || !editDescription.trim()) return;
      let inputSchema: object;
      try {
        inputSchema = JSON.parse(editInputSchemaJson);
      } catch {
        setError("Input schema must be valid JSON");
        return;
      }
      if (!editUrl.trim()) {
        setError("URL is required for API tools");
        return;
      }
      let headers: Record<string, string> | undefined;
      if (editHeadersJson.trim()) {
        try {
          const parsed = JSON.parse(editHeadersJson) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            headers = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === "string") headers[k] = v;
            }
            if (Object.keys(headers).length === 0) headers = undefined;
          }
        } catch {
          setError("Headers must be valid JSON");
          return;
        }
      }
      setError(null);
      try {
        const config: { url: string; method: string; inputSchema: object; headers?: Record<string, string> } = {
          url: editUrl.trim(),
          method: editMethod,
          inputSchema,
        };
        if (headers) config.headers = headers;
        const res = await fetch(`/api/tools/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            description: editDescription.trim(),
            type: "api",
            config,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update tool");
        }
        setEditingId(null);
        await fetchTools();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update tool");
      }
    },
    [
      editingId,
      editName,
      editDescription,
      editUrl,
      editMethod,
      editInputSchemaJson,
      editHeadersJson,
      fetchTools,
    ]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this tool?")) return;
      setMenuOpenId(null);
      setError(null);
      try {
        const res = await fetch(`/api/tools/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        if (editingId === id) setEditingId(null);
        await fetchTools();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete tool");
      }
    },
    [fetchTools, editingId]
  );

  const renderToolConfig = (t: ToolRecord) => {
    if (t.type !== "api") return null;
    try {
      const c = JSON.parse(t.config) as { url?: string; method?: string };
      return (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {c.method ?? "GET"} {c.url ?? ""}
        </p>
      );
    } catch {
      return null;
    }
  };

  const editFormJsx = (t: ToolRecord) =>
    editingId === t.id ? (
      <form onSubmit={handleUpdate} className="space-y-4">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          type="url"
          value={editUrl}
          onChange={(e) => setEditUrl(e.target.value)}
          placeholder="URL"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <select
          value={editMethod}
          onChange={(e) => setEditMethod(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Headers (optional)
          </label>
          <textarea
            value={editHeadersJson}
            onChange={(e) => setEditHeadersJson(e.target.value)}
            placeholder='{"Authorization": "Bearer ..."}'
            rows={2}
            className="font-mono w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <textarea
          value={editInputSchemaJson}
          onChange={(e) => setEditInputSchemaJson(e.target.value)}
          placeholder="Input schema JSON"
          rows={4}
          className="font-mono w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
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
    ) : undefined;

  return (
    <ResourcePageLayout
      title="Tools"
      description="Configure API-call tools. Assign them to agents or to the Master agent so they can call external APIs."
      error={error}
      actionBar={
        <ResourceActionBar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          addLabel="Add tool"
          onAdd={() => setCreateModalOpen(true)}
          showAddButton={true}
        />
      }
    >
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="New tool (API)"
        maxWidth="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-tool-form"
              disabled={submitting}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {submitting ? "Creating…" : "Create tool"}
            </button>
          </>
        }
      >
        <form id="create-tool-form" onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="ai-prompt" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              AI assist
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Describe the tool you want; AI will fill the form below.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <textarea
                id="ai-prompt"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Search the web with Serpstack using query and optional location"
                rows={2}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
              />
              <button
                type="button"
                onClick={handleAiFill}
                disabled={!aiPrompt.trim() || aiLoading}
                className="shrink-0 rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
              >
                {aiLoading ? "Filling…" : "Fill form with AI"}
              </button>
            </div>
            {aiError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {aiError}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setName(SERPSTACK_TEMPLATE.name);
                setDescription(SERPSTACK_TEMPLATE.description);
                setUrl(SERPSTACK_TEMPLATE.url);
                setMethod(SERPSTACK_TEMPLATE.method);
                setInputSchemaJson(JSON.stringify(SERPSTACK_TEMPLATE.inputSchema, null, 2));
                setHeadersJson("");
              }}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Use Serpstack search template
            </button>
            <button
              type="button"
              onClick={() => {
                setName(FETCH_WEBSITE_TEMPLATE.name);
                setDescription(FETCH_WEBSITE_TEMPLATE.description);
                setUrl(typeof window !== "undefined" ? `${window.location.origin}/api/proxy/fetch-website` : "/api/proxy/fetch-website");
                setMethod(FETCH_WEBSITE_TEMPLATE.method);
                setInputSchemaJson(JSON.stringify(FETCH_WEBSITE_TEMPLATE.inputSchema, null, 2));
                setHeadersJson("");
              }}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Use Fetch website template
            </button>
          </div>
          <div>
            <label htmlFor="tool-name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Name (unique, used as tool key)
            </label>
            <input
              id="tool-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. search_web"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div>
            <label htmlFor="tool-description" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description (tells the model when to use this tool)
            </label>
            <textarea
              id="tool-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Search the web for the given query."
              rows={2}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div>
            <label htmlFor="tool-url" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              URL
            </label>
            <input
              id="tool-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/search"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div>
            <label htmlFor="tool-method" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Method
            </label>
            <select
              id="tool-method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tool-headers" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Headers (optional, JSON object for API keys etc.)
            </label>
            <textarea
              id="tool-headers"
              value={headersJson}
              onChange={(e) => setHeadersJson(e.target.value)}
              placeholder='{"Authorization": "Bearer YOUR_KEY"}'
              rows={2}
              className="font-mono w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div>
            <label htmlFor="tool-schema" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Input schema (JSON Schema for parameters the model will send)
            </label>
            <textarea
              id="tool-schema"
              value={inputSchemaJson}
              onChange={(e) => setInputSchemaJson(e.target.value)}
              placeholder='{"type":"object","properties":{...},"required":[]}'
              rows={6}
              className="font-mono w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
        </form>
      </Modal>

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading tools…</p>
      ) : tools.length === 0 ? (
        <EmptyState
          message="No tools yet. Create one to assign to agents or the Master agent."
          actionLabel="Create tool"
          onAction={() => setCreateModalOpen(true)}
        />
      ) : viewMode === "cards" ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tools.map((t) => {
            const isEditing = editingId === t.id;
            const menu = (
              <DropdownMenu
                isOpen={menuOpenId === t.id}
                onOpenChange={(open) => setMenuOpenId(open ? t.id : null)}
                triggerLabel="Tool options"
                actions={[
                  { label: "Edit", onClick: () => startEdit(t) },
                  { label: "Delete", onClick: () => handleDelete(t.id), destructive: true },
                ]}
              />
            );
            const content = (
              <>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {t.name}
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {t.description}
                </p>
                {renderToolConfig(t)}
              </>
            );
            return (
              <ResourceCard
                key={t.id}
                menu={menu}
                editForm={editFormJsx(t)}
                isEditing={isEditing}
                onClick={() => startEdit(t)}
              >
                {content}
              </ResourceCard>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-2">
          {tools.map((t) => {
            const isEditing = editingId === t.id;
            const menu = (
              <DropdownMenu
                isOpen={menuOpenId === t.id}
                onOpenChange={(open) => setMenuOpenId(open ? t.id : null)}
                triggerLabel="Tool options"
                actions={[
                  { label: "Edit", onClick: () => startEdit(t) },
                  { label: "Delete", onClick: () => handleDelete(t.id), destructive: true },
                ]}
              />
            );
            const content = (
              <>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {t.name}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {" "}
                  · {t.description}
                </span>
                {renderToolConfig(t)}
              </>
            );
            return (
              <ResourceRow
                key={t.id}
                menu={menu}
                editForm={editFormJsx(t)}
                isEditing={isEditing}
                onClick={() => startEdit(t)}
              >
                {content}
              </ResourceRow>
            );
          })}
        </ul>
      )}
    </ResourcePageLayout>
  );
}
