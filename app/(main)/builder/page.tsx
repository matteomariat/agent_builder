"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatPane } from "../components/ChatPane";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageThinkingBlock, type MetaPart } from "../components/MessageThinkingBlock";
import { isTextPart, isReasoningPart, isStepStartPart, isToolPart } from "../components/chat-parts";
import { BUILDER_SYSTEM_PROMPT } from "@/lib/agents/builder-constants";

const MODELS = [
  { value: "", label: "Default (Gemini 2.5 Flash)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
];

type AgentRecord = {
  id: string;
  name: string;
  systemPrompt: string;
  model: string | null;
  maxSteps: number | null;
  thinkingEnabled: boolean | null;
  toolIds?: string[];
};
type ToolOption = { id: string; name: string };
type FileOption = { id: string; filename: string };

function getMessageText(m: { role: string; parts?: { type?: string; text?: string }[] }): string {
  if ("parts" in m && Array.isArray(m.parts)) {
    return m.parts.map((p) => (p.type === "text" ? p.text ?? "" : "")).join("");
  }
  return "";
}

const markdownComponents: Parameters<typeof ReactMarkdown>[0]["components"] = {
  p: ({ children }) => <p className="my-1 first:mt-0 last:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  pre: ({ children }) => (
    <pre className="my-1 overflow-x-auto rounded bg-black/10 p-2 font-mono text-xs dark:bg-white/10">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => (
    <code
      className={className != null ? undefined : "rounded bg-black/10 px-1 font-mono text-sm dark:bg-white/10"}
      {...props}
    >
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">
      {children}
    </a>
  ),
};

function TestChatPane({ agentId }: { agentId: string }) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/agents/${agentId}/chat` }),
    [agentId]
  );
  const { messages, sendMessage, status, setMessages } = useChat({
    id: `test-${agentId}`,
    transport,
  });
  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text || isLoading) return;
      setInput("");
      sendMessage({ text });
    },
    [input, isLoading, sendMessage]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Test agent</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Send a message to test this agent.</p>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li
                key={m.id}
                className={
                  m.role === "user" ? "flex justify-end" : "flex justify-start flex-col items-start"
                }
              >
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
                    <p className="whitespace-pre-wrap">{getMessageText(m)}</p>
                  </div>
                ) : (() => {
                  const parts = "parts" in m && Array.isArray(m.parts) ? m.parts : [];
                  const metaParts: MetaPart[] = [];
                  const textParts: string[] = [];
                  for (const part of parts as { type?: string; text?: string; toolName?: string; toolCallId?: string; input?: unknown; output?: unknown }[]) {
                    if (isTextPart(part as { type: string; text?: string })) {
                      const t = (part as { text?: string }).text ?? "";
                      if (t.trim()) textParts.push(t);
                    } else if (isReasoningPart(part as { type: string; text?: string }) || isStepStartPart(part as { type: string }) || isToolPart(part as { type: string })) {
                      metaParts.push(part as MetaPart);
                    }
                  }
                  const hasMeta = metaParts.length > 0;
                  const textContent = textParts.length > 0 ? textParts.join("") : getMessageText(m);
                  return (
                    <div className="flex max-w-[85%] flex-col gap-1.5">
                      {hasMeta && <MessageThinkingBlock parts={metaParts} />}
                      <div className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 break-words w-full">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {textContent}
                        </ReactMarkdown>
                      </div>
                    </div>
                  );
                })()}
              </li>
            ))}
          </ul>
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-800 shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the agent…"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isLoading ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function BuilderPage() {
  const [builderConversationId, setBuilderConversationId] = useState<string | null>(null);
  const [builderLoading, setBuilderLoading] = useState(true);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"form" | "test">("form");
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("");
  const [maxSteps, setMaxSteps] = useState<number | "">(5);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [availableTools, setAvailableTools] = useState<ToolOption[]>([]);
  const [availableFiles, setAvailableFiles] = useState<FileOption[]>([]);
  const [knowledgeGuidance, setKnowledgeGuidance] = useState("");
  const [knowledgeRules, setKnowledgeRules] = useState("");
  const [knowledgeStyle, setKnowledgeStyle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [agentFormLoading, setAgentFormLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [builderSystemPrompt, setBuilderSystemPrompt] = useState("");
  const [builderModel, setBuilderModel] = useState("gemini-2.5-flash");
  const [builderMaxSteps, setBuilderMaxSteps] = useState<number | "">(15);
  const [builderThinkingEnabled, setBuilderThinkingEnabled] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/builder/conversation");
        if (res.ok) {
          const data = await res.json();
          setBuilderConversationId(data.conversationId ?? null);
        }
      } catch {
        // ignore
      } finally {
        setBuilderLoading(false);
      }
    })();
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch("/api/tools");
      if (res.ok) {
        const data = await res.json();
        setAvailableTools(Array.isArray(data) ? data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })) : []);
      }
    } catch {
      // ignore
    }
  }, []);

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
    fetchAgents();
    fetchTools();
    fetchFiles();
  }, [fetchAgents, fetchTools, fetchFiles]);

  const loadAgentIntoForm = useCallback(async (id: string) => {
    try {
      const [agentRes, knowledgeRes, filesRes] = await Promise.all([
        fetch(`/api/agents/${id}`),
        fetch(`/api/knowledge?ownerType=agent&ownerId=${encodeURIComponent(id)}`),
        fetch(`/api/agents/${id}/assigned-files`),
      ]);
      if (!agentRes.ok) return;
      const agent: AgentRecord = await agentRes.json();
      setName(agent.name ?? "");
      setSystemPrompt(agent.systemPrompt ?? "");
      setModel(agent.model ?? "");
      setMaxSteps(agent.maxSteps ?? 5);
      setThinkingEnabled(Boolean(agent.thinkingEnabled));
      setSelectedToolIds(Array.isArray(agent.toolIds) ? agent.toolIds : []);
      if (knowledgeRes.ok) {
        const items: { type: string; content: string }[] = await knowledgeRes.json();
        const byType: Record<string, string> = { guidance: "", rules: "", style: "" };
        for (const item of items) {
          if (item.type in byType) byType[item.type as keyof typeof byType] = item.content ?? "";
        }
        setKnowledgeGuidance(byType.guidance ?? "");
        setKnowledgeRules(byType.rules ?? "");
        setKnowledgeStyle(byType.style ?? "");
      }
      if (filesRes.ok) {
        const filesData = await filesRes.json();
        setSelectedFileIds(Array.isArray(filesData) ? filesData.map((f: { id: string }) => f.id) : []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!currentAgentId) {
      setAgentFormLoading(false);
      setName("");
      setSystemPrompt("");
      setModel("");
      setMaxSteps(5);
      setThinkingEnabled(false);
      setSelectedToolIds([]);
      setSelectedFileIds([]);
      setKnowledgeGuidance("");
      setKnowledgeRules("");
      setKnowledgeStyle("");
      return;
    }
    setAgentFormLoading(true);
    loadAgentIntoForm(currentAgentId).finally(() => {
      setAgentFormLoading(false);
      fetchAgents();
    });
  }, [currentAgentId, loadAgentIntoForm, fetchAgents]);

  const onBuilderToolResult = useCallback(
    (toolName: string, result: unknown) => {
      const obj = result && typeof result === "object" ? (result as Record<string, unknown>) : null;
      if (toolName === "create_agent" || toolName === "update_agent") {
        const id = typeof obj?.id === "string" ? obj.id : null;
        if (id) {
          setRightTab("form");
          setCurrentAgentId(id);
        }
      } else if (toolName === "focus_agent") {
        const agentId = typeof obj?.agentId === "string" ? obj.agentId : typeof obj?.id === "string" ? obj.id : null;
        if (agentId) {
          setRightTab("form");
          setCurrentAgentId(agentId);
        }
      } else if (
        ["create_knowledge", "update_knowledge", "delete_knowledge", "set_agent_file_assignments"].includes(toolName) &&
        currentAgentId
      ) {
        setAgentFormLoading(true);
        loadAgentIntoForm(currentAgentId).finally(() => setAgentFormLoading(false));
      }
    },
    [loadAgentIntoForm, currentAgentId]
  );

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !systemPrompt.trim()) {
        setFormError("Name and system prompt are required");
        return;
      }
      setSubmitting(true);
      setFormError(null);
      try {
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            systemPrompt: systemPrompt.trim(),
            model: model.trim() || undefined,
            maxSteps: maxSteps !== "" && Number(maxSteps) >= 1 && Number(maxSteps) <= 50 ? Number(maxSteps) : undefined,
            thinkingEnabled: thinkingEnabled || undefined,
            toolIds: selectedToolIds.length > 0 ? selectedToolIds : undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create agent");
        }
        const created = await res.json();
        const newId = created.id as string;
        for (const { type, content } of [
          { type: "guidance" as const, content: knowledgeGuidance },
          { type: "rules" as const, content: knowledgeRules },
          { type: "style" as const, content: knowledgeStyle },
        ]) {
          if (content.trim()) {
            await fetch("/api/knowledge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ownerType: "agent", ownerId: newId, type, content: content.trim() }),
            });
          }
        }
        if (selectedFileIds.length > 0) {
          await fetch(`/api/agents/${newId}/file-assignments`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileIds: selectedFileIds }),
          });
        }
        setCurrentAgentId(newId);
        await fetchAgents();
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Failed to create agent");
      } finally {
        setSubmitting(false);
      }
    },
    [name, systemPrompt, model, maxSteps, thinkingEnabled, selectedToolIds, selectedFileIds, knowledgeGuidance, knowledgeRules, knowledgeStyle, fetchAgents]
  );

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentAgentId || !name.trim() || !systemPrompt.trim()) {
        setFormError("Name and system prompt are required");
        return;
      }
      setSubmitting(true);
      setFormError(null);
      try {
        const res = await fetch(`/api/agents/${currentAgentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            systemPrompt: systemPrompt.trim(),
            model: model.trim() || null,
            maxSteps: maxSteps !== "" && Number(maxSteps) >= 1 && Number(maxSteps) <= 50 ? Number(maxSteps) : null,
            thinkingEnabled: thinkingEnabled,
            toolIds: selectedToolIds,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update agent");
        }
        const existingItemsRes = await fetch(`/api/knowledge?ownerType=agent&ownerId=${encodeURIComponent(currentAgentId)}`);
        const existingItems: { id: string; type: string; content: string }[] = existingItemsRes.ok ? await existingItemsRes.json() : [];
        const updates = [
          { type: "guidance" as const, content: knowledgeGuidance.trim() },
          { type: "rules" as const, content: knowledgeRules.trim() },
          { type: "style" as const, content: knowledgeStyle.trim() },
        ];
        for (const { type, content } of updates) {
          const existing = existingItems.find((i) => i.type === type);
          if (existing) {
            await fetch(`/api/knowledge/${existing.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content }),
            });
          } else if (content) {
            await fetch("/api/knowledge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ownerType: "agent", ownerId: currentAgentId, type, content }),
            });
          }
        }
        await fetch(`/api/agents/${currentAgentId}/file-assignments`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds: selectedFileIds }),
        });
        await fetchAgents();
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Failed to update agent");
      } finally {
        setSubmitting(false);
      }
    },
    [currentAgentId, name, systemPrompt, model, maxSteps, thinkingEnabled, selectedToolIds, selectedFileIds, knowledgeGuidance, knowledgeRules, knowledgeStyle, fetchAgents]
  );

  if (builderLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading AI Builder…</p>
      </div>
    );
  }

  if (!builderConversationId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <p className="text-sm text-red-600 dark:text-red-400">Could not load builder conversation.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-screen flex-col md:flex-row">
      <aside className="flex w-full md:w-[400px] md:min-w-[320px] md:max-w-[480px] flex-shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <ChatPane
          conversationId={builderConversationId}
          title="AI Builder"
          placeholder="Describe what you want to build or edit. The assistant can create or update agents, manage knowledge, and edit files."
          onToolResult={onBuilderToolResult}
        />
      </aside>
      <section className="flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex">
            <button
              type="button"
              onClick={() => setRightTab("form")}
              className={`px-4 py-3 text-sm font-medium ${rightTab === "form" ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"}`}
            >
              Agent (WIP)
            </button>
            <button
              type="button"
              onClick={() => setRightTab("test")}
              className={`px-4 py-3 text-sm font-medium ${rightTab === "test" ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"}`}
            >
              Test chat
            </button>
          </div>
          <button
            type="button"
            onClick={async () => {
              setShowSettings(true);
              try {
                const res = await fetch("/api/builder/settings");
                if (res.ok) {
                  const data = await res.json();
                  setBuilderSystemPrompt(data.systemPrompt ?? "");
                  setBuilderModel(data.model ?? "gemini-2.5-flash");
                  setBuilderMaxSteps(data.maxSteps ?? 15);
                  setBuilderThinkingEnabled(Boolean(data.thinkingEnabled));
                }
              } catch {
                // ignore
              }
            }}
            className="mr-4 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Settings
          </button>
        </div>
        {showSettings && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="AI Builder settings"
            onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}
          >
            <div
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI Builder settings</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSettingsSaving(true);
                  try {
                    const res = await fetch("/api/builder/settings", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        systemPrompt: builderSystemPrompt.trim() || null,
                        model: builderModel.trim() || null,
                        maxSteps: builderMaxSteps !== "" && Number(builderMaxSteps) >= 1 && Number(builderMaxSteps) <= 50 ? Number(builderMaxSteps) : null,
                        thinkingEnabled: builderThinkingEnabled,
                      }),
                    });
                    if (res.ok) setShowSettings(false);
                  } finally {
                    setSettingsSaving(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      System prompt
                    </label>
                    <button
                      type="button"
                      onClick={() => setBuilderSystemPrompt(BUILDER_SYSTEM_PROMPT)}
                      className="rounded border border-zinc-300 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                    >
                      Use default prompt
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Defines how the AI Builder behaves in the chat. Leave empty to use the default.
                  </p>
                  <textarea
                    value={builderSystemPrompt}
                    onChange={(e) => setBuilderSystemPrompt(e.target.value)}
                    rows={12}
                    placeholder="Leave empty to use the default AI Builder prompt."
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Model</label>
                  <select
                    value={builderModel}
                    onChange={(e) => setBuilderModel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {MODELS.map((m) => (
                      <option key={m.value || "default"} value={m.value || "gemini-2.5-flash"}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Max steps</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={builderMaxSteps}
                    onChange={(e) => setBuilderMaxSteps(e.target.value === "" ? "" : Number(e.target.value))}
                    className="mt-1 w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={builderThinkingEnabled}
                    onChange={(e) => setBuilderThinkingEnabled(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Thinking enabled</span>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={settingsSaving}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {settingsSaving ? "…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">
          {rightTab === "form" ? (
            <div className="relative mx-auto min-h-[320px] max-w-2xl space-y-6">
              {agentFormLoading && (
                <div
                  className="absolute inset-0 z-10 flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-xl bg-zinc-50/95 dark:bg-zinc-950/95"
                  aria-busy="true"
                  aria-label="Loading agent"
                >
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-300" />
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Loading agent…</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentAgentId(null)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  New agent
                </button>
                {agents.length > 0 && (
                  <select
                    value={currentAgentId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCurrentAgentId(v || null);
                    }}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    <option value="">Select agent to edit…</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200" role="alert">
                  {formError}
                </div>
              )}
              <form onSubmit={currentAgentId ? handleSave : handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">System prompt</label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={6}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {MODELS.map((m) => (
                      <option key={m.value || "default"} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Max steps</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={maxSteps}
                      onChange={(e) => setMaxSteps(e.target.value === "" ? "" : Number(e.target.value))}
                      className="mt-1 w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <label className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={thinkingEnabled}
                      onChange={(e) => setThinkingEnabled(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Thinking enabled</span>
                  </label>
                </div>
                {availableTools.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tools</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {availableTools.map((t) => (
                        <label key={t.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedToolIds.includes(t.id)}
                            onChange={(e) =>
                              setSelectedToolIds((prev) =>
                                e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                              )
                            }
                            className="rounded border-zinc-300"
                          />
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">{t.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Knowledge — Guidance</label>
                  <textarea
                    value={knowledgeGuidance}
                    onChange={(e) => setKnowledgeGuidance(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Knowledge — Rules</label>
                  <textarea
                    value={knowledgeRules}
                    onChange={(e) => setKnowledgeRules(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Knowledge — Style</label>
                  <textarea
                    value={knowledgeStyle}
                    onChange={(e) => setKnowledgeStyle(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                {availableFiles.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Assigned files</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {availableFiles.map((f) => (
                        <label key={f.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedFileIds.includes(f.id)}
                            onChange={(e) =>
                              setSelectedFileIds((prev) =>
                                e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id)
                              )
                            }
                            className="rounded border-zinc-300"
                          />
                          <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{f.filename}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {submitting ? "…" : currentAgentId ? "Save" : "Create"}
                </button>
              </form>
            </div>
          ) : (
            currentAgentId ? (
              <div className="h-full min-h-[400px]">
                <TestChatPane agentId={currentAgentId} />
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Select or create an agent in the form to test it here.</p>
            )
          )}
        </div>
      </section>
    </div>
  );
}
