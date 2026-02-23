"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ResourcePageLayout,
  ResourceActionBar,
  ResourceCard,
  ResourceRow,
  EmptyState,
  FormCard,
  DropdownMenu,
} from "@/app/(main)/components/resource-list";

const VIEW_MODE_KEY = "resource-view-agents";

type AgentRecord = {
  id: string;
  name: string;
  systemPrompt: string;
  model: string | null;
  knowledge: string | null;
  maxSteps: number | null;
  thinkingEnabled: boolean | null;
  toolIds?: string[];
  createdAt: string;
};

type MasterAgentRecord = {
  id: string;
  name: string;
  model: string | null;
  updatedAt: string | null;
  systemPrompt?: string;
  maxSteps?: number;
  thinkingEnabled?: boolean;
  toolIds?: string[];
  subAgentIds?: string[];
};

type UnifiedItem =
  | { kind: "agent"; sortAt: string; data: AgentRecord }
  | { kind: "master"; sortAt: string; data: MasterAgentRecord };

const DEFAULT_MASTER_SYSTEM_PROMPT = `You are the Master agent. You coordinate work by:
1. Delegating to user-created agents via the invoke_agent tool (pass agentId and message).
2. Writing to the shared working doc via write_to_doc (append or replace). Only write when the user is not editing.
3. Using the research tool to search/summarize the user's uploaded files.

Always be helpful and concise. When you delegate to another agent, summarize their result for the user. When you write to the doc, use clear structure (headings, lists).`;

type ToolOption = { id: string; name: string };
type FileOption = { id: string; filename: string };

const MODELS = [
  { value: "", label: "Default (Gemini 2.5 Flash)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (legacy)" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function AgentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [masterAgents, setMasterAgents] = useState<MasterAgentRecord[]>([]);
  const [unifiedList, setUnifiedList] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createAs, setCreateAs] = useState<"agent" | "master">("agent");
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("");
  const [knowledgeGuidance, setKnowledgeGuidance] = useState("");
  const [knowledgeRules, setKnowledgeRules] = useState("");
  const [knowledgeStyle, setKnowledgeStyle] = useState("");
  const [useDefaultGuidance, setUseDefaultGuidance] = useState(true);
  const [useDefaultRules, setUseDefaultRules] = useState(true);
  const [useDefaultStyle, setUseDefaultStyle] = useState(true);
  const [maxSteps, setMaxSteps] = useState<number | "">("");
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [masterName, setMasterName] = useState("");
  const [masterSystemPrompt, setMasterSystemPrompt] = useState(DEFAULT_MASTER_SYSTEM_PROMPT);
  const [masterModel, setMasterModel] = useState("gemini-2.5-flash");
  const [masterMaxSteps, setMasterMaxSteps] = useState(10);
  const [masterThinkingEnabled, setMasterThinkingEnabled] = useState(false);
  const [masterToolIds, setMasterToolIds] = useState<string[]>([]);
  const [masterSubAgentIds, setMasterSubAgentIds] = useState<string[]>([]);
  const [masterKnowledgeGuidance, setMasterKnowledgeGuidance] = useState("");
  const [masterKnowledgeRules, setMasterKnowledgeRules] = useState("");
  const [masterKnowledgeStyle, setMasterKnowledgeStyle] = useState("");
  const [masterUseDefaultGuidance, setMasterUseDefaultGuidance] = useState(true);
  const [masterUseDefaultRules, setMasterUseDefaultRules] = useState(true);
  const [masterUseDefaultStyle, setMasterUseDefaultStyle] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editKnowledgeGuidance, setEditKnowledgeGuidance] = useState("");
  const [editKnowledgeRules, setEditKnowledgeRules] = useState("");
  const [editKnowledgeStyle, setEditKnowledgeStyle] = useState("");
  const [editUseDefaultGuidance, setEditUseDefaultGuidance] = useState(true);
  const [editUseDefaultRules, setEditUseDefaultRules] = useState(true);
  const [editUseDefaultStyle, setEditUseDefaultStyle] = useState(true);
  const [editMaxSteps, setEditMaxSteps] = useState<number | "">("");
  const [editThinkingEnabled, setEditThinkingEnabled] = useState(false);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [editToolIds, setEditToolIds] = useState<string[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [editSelectedFileIds, setEditSelectedFileIds] = useState<string[]>([]);
  const [availableFiles, setAvailableFiles] = useState<FileOption[]>([]);
  const [availableTools, setAvailableTools] = useState<ToolOption[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === "list" || stored === "cards") setViewMode(stored);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

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

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsRes, masterRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/master-agents"),
      ]);
      if (!agentsRes.ok) throw new Error("Failed to load agents");
      if (!masterRes.ok) throw new Error("Failed to load master agents");
      const agentsData: AgentRecord[] = await agentsRes.json();
      const masterData: MasterAgentRecord[] = await masterRes.json();
      setAgents(agentsData);
      setMasterAgents(masterData);
      const unified: UnifiedItem[] = [
        ...agentsData.map((a) => ({
          kind: "agent" as const,
          sortAt: typeof a.createdAt === "string" ? a.createdAt : (a.createdAt as Date)?.toISOString?.() ?? "",
          data: a,
        })),
        ...masterData.map((m) => ({
          kind: "master" as const,
          sortAt:
            typeof m.updatedAt === "string"
              ? (m.updatedAt ?? "")
              : m.updatedAt != null
                ? (m.updatedAt as Date).toISOString?.() ?? ""
                : "",
          data: m,
        })),
      ].sort((a, b) => (b.sortAt > a.sortAt ? 1 : -1));
      setUnifiedList(unified);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchParams.get("create") === "master") {
      setShowCreateForm(true);
      setCreateAs("master");
    }
  }, [searchParams]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

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
            maxSteps:
              maxSteps !== "" && Number(maxSteps) >= 1 && Number(maxSteps) <= 50
                ? Number(maxSteps)
                : undefined,
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
                ownerType: "agent",
                ownerId: newId,
                type,
                content: content.trim(),
              }),
            });
          }
        }
        setName("");
        setSystemPrompt("");
        setModel("");
        setKnowledgeGuidance("");
        setKnowledgeRules("");
        setKnowledgeStyle("");
        setUseDefaultGuidance(true);
        setUseDefaultRules(true);
        setUseDefaultStyle(true);
        setMaxSteps("");
        setThinkingEnabled(false);
        const newAgentId = created.id as string;
        const fileIdsToAssign = selectedFileIds;
        setSelectedToolIds([]);
        setSelectedFileIds([]);
        setShowCreateForm(false);
        if (fileIdsToAssign.length > 0) {
          await fetch(`/api/agents/${newAgentId}/file-assignments`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileIds: fileIdsToAssign }),
          });
        }
        await fetchAgents();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create agent");
      } finally {
        setSubmitting(false);
      }
    },
    [name, systemPrompt, model, knowledgeGuidance, knowledgeRules, knowledgeStyle, useDefaultGuidance, useDefaultRules, useDefaultStyle, maxSteps, thinkingEnabled, selectedToolIds, selectedFileIds, fetchAgents]
  );

  const handleCreateMaster = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!masterName.trim() || !masterSystemPrompt.trim()) {
        setError("Name and system prompt are required");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/master-agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: masterName.trim(),
            systemPrompt: masterSystemPrompt.trim(),
            model: masterModel.trim() || null,
            maxSteps: masterMaxSteps >= 1 && masterMaxSteps <= 100 ? masterMaxSteps : 10,
            thinkingEnabled: masterThinkingEnabled,
            toolIds: masterToolIds.length > 0 ? masterToolIds : undefined,
            subAgentIds: masterSubAgentIds.length > 0 ? masterSubAgentIds : undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create master agent");
        }
        const created = await res.json();
        const newId = created.id as string;
        for (const { type, useDefault, content } of [
          { type: "guidance" as const, useDefault: masterUseDefaultGuidance, content: masterKnowledgeGuidance },
          { type: "rules" as const, useDefault: masterUseDefaultRules, content: masterKnowledgeRules },
          { type: "style" as const, useDefault: masterUseDefaultStyle, content: masterKnowledgeStyle },
        ]) {
          if (!useDefault && content.trim()) {
            await fetch("/api/knowledge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ownerType: "master",
                ownerId: newId,
                type,
                content: content.trim(),
              }),
            });
          }
        }
        setMasterName("");
        setMasterSystemPrompt(DEFAULT_MASTER_SYSTEM_PROMPT);
        setMasterModel("gemini-2.5-flash");
        setMasterMaxSteps(10);
        setMasterThinkingEnabled(false);
        setMasterToolIds([]);
        setMasterSubAgentIds([]);
        setMasterKnowledgeGuidance("");
        setMasterKnowledgeRules("");
        setMasterKnowledgeStyle("");
        setMasterUseDefaultGuidance(true);
        setMasterUseDefaultRules(true);
        setMasterUseDefaultStyle(true);
        setShowCreateForm(false);
        await fetchAgents();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create master agent");
      } finally {
        setSubmitting(false);
      }
    },
    [
      masterName,
      masterSystemPrompt,
      masterModel,
      masterMaxSteps,
      masterThinkingEnabled,
      masterToolIds,
      masterSubAgentIds,
      masterKnowledgeGuidance,
      masterKnowledgeRules,
      masterKnowledgeStyle,
      masterUseDefaultGuidance,
      masterUseDefaultRules,
      masterUseDefaultStyle,
      fetchAgents,
    ]
  );

  const handleDeleteMaster = useCallback(
    async (ma: MasterAgentRecord) => {
      if (!confirm(`Delete "${ma.name}"?`)) return;
      setMenuOpenId(null);
      setError(null);
      try {
        const res = await fetch(`/api/master-agents/${ma.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        await fetchAgents();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete");
      }
    },
    [fetchAgents]
  );

  const handleDuplicateMaster = useCallback(
    async (ma: MasterAgentRecord) => {
      setMenuOpenId(null);
      setError(null);
      try {
        const detailRes = await fetch(`/api/master-agents/${ma.id}`);
        if (!detailRes.ok) throw new Error("Failed to load master agent");
        const detail = await detailRes.json();
        const res = await fetch("/api/master-agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${detail.name} (copy)`,
            systemPrompt: detail.systemPrompt ?? DEFAULT_MASTER_SYSTEM_PROMPT,
            model: detail.model ?? null,
            maxSteps: typeof detail.maxSteps === "number" ? detail.maxSteps : 10,
            thinkingEnabled: Boolean(detail.thinkingEnabled),
            toolIds: Array.isArray(detail.toolIds) ? detail.toolIds : undefined,
            subAgentIds: Array.isArray(detail.subAgentIds) ? detail.subAgentIds : undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to duplicate");
        }
        const created = await res.json();
        const newId = created.id as string;
        const knowledgeRes = await fetch(`/api/knowledge?ownerType=master&ownerId=${encodeURIComponent(ma.id)}`);
        if (knowledgeRes.ok) {
          const items: { type: string; content: string }[] = await knowledgeRes.json();
          for (const item of items) {
            if (item.type && (item.content ?? "").trim()) {
              await fetch("/api/knowledge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ownerType: "master",
                  ownerId: newId,
                  type: item.type,
                  content: (item.content ?? "").trim(),
                }),
              });
            }
          }
        }
        await fetchAgents();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to duplicate master agent");
      }
    },
    [fetchAgents]
  );

  const startEdit = useCallback(async (a: AgentRecord) => {
    setMenuOpenId(null);
    setEditingId(a.id);
    setEditName(a.name);
    setEditSystemPrompt(a.systemPrompt);
    setEditModel(a.model ?? "");
    setEditMaxSteps(a.maxSteps ?? "");
    setEditThinkingEnabled(Boolean(a.thinkingEnabled));
    setEditToolIds(a.toolIds ?? []);
    setEditKnowledgeGuidance("");
    setEditKnowledgeRules("");
    setEditKnowledgeStyle("");
    setEditUseDefaultGuidance(true);
    setEditUseDefaultRules(true);
    setEditUseDefaultStyle(true);
    setEditSelectedFileIds([]);
    try {
      const [knowledgeRes, filesRes] = await Promise.all([
        fetch(`/api/knowledge?ownerType=agent&ownerId=${encodeURIComponent(a.id)}`),
        fetch(`/api/agents/${a.id}/assigned-files`),
      ]);
      if (knowledgeRes.ok) {
        const items: { type: string; content: string }[] = await knowledgeRes.json();
        const byType: Record<string, string[]> = { guidance: [], rules: [], style: [] };
        for (const item of items) {
          if (item.type in byType && (item.content ?? "").trim()) {
            byType[item.type as keyof typeof byType].push((item.content ?? "").trim());
          }
        }
        const g = byType.guidance.join("\n\n");
        const r = byType.rules.join("\n\n");
        const s = byType.style.join("\n\n");
        setEditKnowledgeGuidance(g);
        setEditUseDefaultGuidance(!g);
        setEditKnowledgeRules(r);
        setEditUseDefaultRules(!r);
        setEditKnowledgeStyle(s);
        setEditUseDefaultStyle(!s);
      }
      if (filesRes.ok) {
        const filesList: { id: string; filename: string }[] = await filesRes.json();
        setEditSelectedFileIds(filesList.map((f) => f.id));
      }
    } catch {
      // keep defaults
    }
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleUpdate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingId || !editName.trim() || !editSystemPrompt.trim()) return;
      setError(null);
      setUpdateSubmitting(true);
      try {
        const res = await fetch(`/api/agents/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            systemPrompt: editSystemPrompt.trim(),
            model: editModel.trim() || null,
            maxSteps:
              editMaxSteps !== "" &&
              Number(editMaxSteps) >= 1 &&
              Number(editMaxSteps) <= 50
                ? Number(editMaxSteps)
                : null,
            thinkingEnabled: editThinkingEnabled,
            toolIds: editToolIds,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update agent");
        }
        const listRes = await fetch(`/api/knowledge?ownerType=agent&ownerId=${encodeURIComponent(editingId)}`);
        if (listRes.ok) {
          const items: { id: string }[] = await listRes.json();
          for (const item of items) {
            await fetch(`/api/knowledge/${item.id}`, { method: "DELETE" });
          }
        }
        for (const { type, useDefault, content } of [
          { type: "guidance" as const, useDefault: editUseDefaultGuidance, content: editKnowledgeGuidance },
          { type: "rules" as const, useDefault: editUseDefaultRules, content: editKnowledgeRules },
          { type: "style" as const, useDefault: editUseDefaultStyle, content: editKnowledgeStyle },
        ]) {
          if (!useDefault && content.trim()) {
            await fetch("/api/knowledge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ownerType: "agent",
                ownerId: editingId,
                type,
                content: content.trim(),
              }),
            });
          }
        }
        await fetch(`/api/agents/${editingId}/file-assignments`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds: editSelectedFileIds }),
        });
        setEditingId(null);
        await fetchAgents();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update agent");
      } finally {
        setUpdateSubmitting(false);
      }
    },
    [
      editingId,
      editName,
      editSystemPrompt,
      editModel,
      editKnowledgeGuidance,
      editKnowledgeRules,
      editKnowledgeStyle,
      editUseDefaultGuidance,
      editUseDefaultRules,
      editUseDefaultStyle,
      editMaxSteps,
      editThinkingEnabled,
      editToolIds,
      editSelectedFileIds,
      fetchAgents,
    ]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this agent?")) return;
      setMenuOpenId(null);
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

  const handleDuplicate = useCallback(
    async (a: AgentRecord) => {
      setMenuOpenId(null);
      setError(null);
      try {
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${a.name} (copy)`,
            systemPrompt: a.systemPrompt,
            model: a.model?.trim() || undefined,
            maxSteps:
              a.maxSteps != null && a.maxSteps >= 1 && a.maxSteps <= 50
                ? a.maxSteps
                : undefined,
            thinkingEnabled: a.thinkingEnabled || undefined,
            toolIds: a.toolIds && a.toolIds.length > 0 ? a.toolIds : undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to duplicate agent");
        }
        const created = await res.json();
        const newId = created.id as string;
        const knowledgeRes = await fetch(`/api/knowledge?ownerType=agent&ownerId=${encodeURIComponent(a.id)}`);
        if (knowledgeRes.ok) {
          const items: { type: string; content: string }[] = await knowledgeRes.json();
          for (const item of items) {
            if (item.type && (item.content ?? "").trim()) {
              await fetch("/api/knowledge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ownerType: "agent",
                  ownerId: newId,
                  type: item.type,
                  content: (item.content ?? "").trim(),
                }),
              });
            }
          }
        }
        await fetchAgents();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to duplicate agent");
      }
    },
    [fetchAgents]
  );

  return (
    <ResourcePageLayout
      title="Agents"
      description="Create agents (sub-agents) or Master agents (project types). Master agents coordinate work and can delegate to sub-agents. Cards show which type each one is."
      error={error}
      actionBar={
        <ResourceActionBar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          addLabel="Add agent"
          onAdd={() => setShowCreateForm(true)}
          showAddButton={!showCreateForm && editingId == null}
          settingsHref="/master/knowledge-defaults"
          settingsLabel="Knowledge defaults"
        />
      }
    >
      {showCreateForm && (
        <form
          onSubmit={createAs === "agent" ? handleCreate : handleCreateMaster}
          className="mb-10"
        >
          <FormCard title="New agent">
        <div className="mb-4">
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Create as
          </span>
          <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-600 p-0.5 bg-zinc-100 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setCreateAs("agent")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                createAs === "agent"
                  ? "bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Agent
            </button>
            <button
              type="button"
              onClick={() => setCreateAs("master")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                createAs === "master"
                  ? "bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Master agent
            </button>
          </div>
        </div>
        {createAs === "agent" ? (
          <>
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
        <div className="mb-4 space-y-3">
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Knowledge (optional)
          </span>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <input
                id="create-use-default-guidance"
                type="checkbox"
                checked={useDefaultGuidance}
                onChange={(e) => setUseDefaultGuidance(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <label htmlFor="create-use-default-guidance" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
            </div>
            <label htmlFor="agent-guidance" className="sr-only">Guidance</label>
            <textarea
              id="agent-guidance"
              value={knowledgeGuidance}
              onChange={(e) => setKnowledgeGuidance(e.target.value)}
              placeholder="Guidance: high-level direction, goals"
              rows={2}
              disabled={useDefaultGuidance}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <input
                id="create-use-default-rules"
                type="checkbox"
                checked={useDefaultRules}
                onChange={(e) => setUseDefaultRules(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <label htmlFor="create-use-default-rules" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
            </div>
            <label htmlFor="agent-rules" className="sr-only">Rules</label>
            <textarea
              id="agent-rules"
              value={knowledgeRules}
              onChange={(e) => setKnowledgeRules(e.target.value)}
              placeholder="Rules: must-follow constraints"
              rows={2}
              disabled={useDefaultRules}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <input
                id="create-use-default-style"
                type="checkbox"
                checked={useDefaultStyle}
                onChange={(e) => setUseDefaultStyle(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <label htmlFor="create-use-default-style" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
            </div>
            <label htmlFor="agent-style" className="sr-only">Style</label>
            <textarea
              id="agent-style"
              value={knowledgeStyle}
              onChange={(e) => setKnowledgeStyle(e.target.value)}
              placeholder="Style: tone, format, voice"
              rows={2}
              disabled={useDefaultStyle}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Knowledge files (RAG)
          </label>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Select which of your files this agent can use as knowledge (RAG). You can also assign files per file from <Link href="/files" className="underline">Files</Link>.
          </p>
          {availableFiles.length === 0 ? (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
              No files yet. Upload files in <Link href="/files" className="underline">Files</Link> first.
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
        <div className="mb-4">
          <label
            htmlFor="agent-max-steps"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Max steps (1–50, optional)
          </label>
          <input
            id="agent-max-steps"
            type="number"
            min={1}
            max={50}
            value={maxSteps === "" ? "" : maxSteps}
            onChange={(e) =>
              setMaxSteps(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="Reserved for future tool use"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
        </div>
        <div className="mb-4 flex items-center gap-2">
          <input
            id="agent-thinking"
            type="checkbox"
            checked={thinkingEnabled}
            onChange={(e) => setThinkingEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <label
            htmlFor="agent-thinking"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Enable extended thinking (when supported by model)
          </label>
        </div>
        <div className="mb-4">
          <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Assigned tools (used when the Master invokes this sub-agent)
          </span>
          {availableTools.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {availableTools.map((tool) => (
                <label
                  key={tool.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={selectedToolIds.includes(tool.id)}
                    onChange={(e) =>
                      setSelectedToolIds((prev) =>
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
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No tools yet. Create API tools in <Link href="/tools" className="underline hover:no-underline">Tools</Link> to assign them to sub-agents.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {submitting ? "Creating…" : "Create agent"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
          </>
        ) : (
          <>
        <div className="mb-4">
          <label htmlFor="master-create-name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Name
          </label>
          <input
            id="master-create-name"
            type="text"
            value={masterName}
            onChange={(e) => setMasterName(e.target.value)}
            placeholder="e.g. Default, Product manager"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="master-create-prompt" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            System prompt
          </label>
          <textarea
            id="master-create-prompt"
            value={masterSystemPrompt}
            onChange={(e) => setMasterSystemPrompt(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div className="mb-4 space-y-3">
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Knowledge (optional)</span>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <input id="master-create-use-guidance" type="checkbox" checked={masterUseDefaultGuidance} onChange={(e) => setMasterUseDefaultGuidance(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800" />
              <label htmlFor="master-create-use-guidance" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
            </div>
            <textarea value={masterKnowledgeGuidance} onChange={(e) => setMasterKnowledgeGuidance(e.target.value)} placeholder="Guidance" rows={2} disabled={masterUseDefaultGuidance} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <input id="master-create-use-rules" type="checkbox" checked={masterUseDefaultRules} onChange={(e) => setMasterUseDefaultRules(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800" />
              <label htmlFor="master-create-use-rules" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
            </div>
            <textarea value={masterKnowledgeRules} onChange={(e) => setMasterKnowledgeRules(e.target.value)} placeholder="Rules" rows={2} disabled={masterUseDefaultRules} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <input id="master-create-use-style" type="checkbox" checked={masterUseDefaultStyle} onChange={(e) => setMasterUseDefaultStyle(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800" />
              <label htmlFor="master-create-use-style" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
            </div>
            <textarea value={masterKnowledgeStyle} onChange={(e) => setMasterKnowledgeStyle(e.target.value)} placeholder="Style" rows={2} disabled={masterUseDefaultStyle} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="master-create-model" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Model</label>
          <select id="master-create-model" value={masterModel} onChange={(e) => setMasterModel(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            {MODELS.map((m) => (
              <option key={m.value || "default"} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label htmlFor="master-create-max-steps" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Max steps (1–100)</label>
          <input id="master-create-max-steps" type="number" min={1} max={100} value={masterMaxSteps} onChange={(e) => setMasterMaxSteps(Number(e.target.value) || 10)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
        </div>
        <div className="mb-4 flex items-center gap-2">
          <input id="master-create-thinking" type="checkbox" checked={masterThinkingEnabled} onChange={(e) => setMasterThinkingEnabled(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800" />
          <label htmlFor="master-create-thinking" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Enable extended thinking</label>
        </div>
        <div className="mb-4">
          <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Assigned tools</span>
          {availableTools.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {availableTools.map((tool) => (
                <label key={tool.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600">
                  <input type="checkbox" checked={masterToolIds.includes(tool.id)} onChange={(e) => setMasterToolIds((prev) => e.target.checked ? [...prev, tool.id] : prev.filter((id) => id !== tool.id))} className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800" />
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">{tool.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No tools yet. Create some in <Link href="/tools" className="underline">Tools</Link>.</p>
          )}
        </div>
        <div className="mb-4">
          <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Sub-agents</span>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">Agents this master can invoke. Only these will appear in its context. Leave empty to allow all agents.</p>
          {agents.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {agents.map((agent) => (
                <label key={agent.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600">
                  <input type="checkbox" checked={masterSubAgentIds.includes(agent.id)} onChange={(e) => setMasterSubAgentIds((prev) => e.target.checked ? [...prev, agent.id] : prev.filter((id) => id !== agent.id))} className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800" />
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">{agent.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No agents yet. Create sub-agents first, then assign them here.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
            {submitting ? "Creating…" : "Create master agent"}
          </button>
          <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Cancel
          </button>
        </div>
          </>
        )}
          </FormCard>
        </form>
      )}

      {editingId != null && (
        <form onSubmit={handleUpdate} className="mb-10">
          <FormCard title={`Edit ${editName || "agent"}`}>
            <div className="mb-4">
              <label
                htmlFor="edit-agent-name"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Name
              </label>
              <input
                id="edit-agent-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Researcher"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
              />
            </div>
            <div className="mb-4">
              <label
                htmlFor="edit-agent-prompt"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                System prompt
              </label>
              <textarea
                id="edit-agent-prompt"
                value={editSystemPrompt}
                onChange={(e) => setEditSystemPrompt(e.target.value)}
                placeholder="Instructions for this agent..."
                rows={4}
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
                    id="edit-use-default-guidance"
                    type="checkbox"
                    checked={editUseDefaultGuidance}
                    onChange={(e) => setEditUseDefaultGuidance(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <label htmlFor="edit-use-default-guidance" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
                </div>
                <label htmlFor="edit-agent-guidance" className="sr-only">Guidance</label>
                <textarea
                  id="edit-agent-guidance"
                  value={editKnowledgeGuidance}
                  onChange={(e) => setEditKnowledgeGuidance(e.target.value)}
                  placeholder="Guidance: high-level direction, goals"
                  rows={2}
                  disabled={editUseDefaultGuidance}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <input
                    id="edit-use-default-rules"
                    type="checkbox"
                    checked={editUseDefaultRules}
                    onChange={(e) => setEditUseDefaultRules(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <label htmlFor="edit-use-default-rules" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
                </div>
                <label htmlFor="edit-agent-rules" className="sr-only">Rules</label>
                <textarea
                  id="edit-agent-rules"
                  value={editKnowledgeRules}
                  onChange={(e) => setEditKnowledgeRules(e.target.value)}
                  placeholder="Rules: must-follow constraints"
                  rows={2}
                  disabled={editUseDefaultRules}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <input
                    id="edit-use-default-style"
                    type="checkbox"
                    checked={editUseDefaultStyle}
                    onChange={(e) => setEditUseDefaultStyle(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <label htmlFor="edit-use-default-style" className="text-sm text-zinc-600 dark:text-zinc-400">Use default</label>
                </div>
                <label htmlFor="edit-agent-style" className="sr-only">Style</label>
                <textarea
                  id="edit-agent-style"
                  value={editKnowledgeStyle}
                  onChange={(e) => setEditKnowledgeStyle(e.target.value)}
                  placeholder="Style: tone, format, voice"
                  rows={2}
                  disabled={editUseDefaultStyle}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Knowledge files (RAG)
              </label>
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                Select which of your files this agent can use as knowledge (RAG). You can also assign files per file from <Link href="/files" className="underline">Files</Link>.
              </p>
              {availableFiles.length === 0 ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                  No files yet. Upload files in <Link href="/files" className="underline">Files</Link> first.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-800">
                  {availableFiles.map((f) => (
                    <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700">
                      <input
                        type="checkbox"
                        checked={editSelectedFileIds.includes(f.id)}
                        onChange={(e) =>
                          setEditSelectedFileIds((prev) =>
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
            <div className="mb-4">
              <label
                htmlFor="edit-agent-model"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Model (optional)
              </label>
              <select
                id="edit-agent-model"
                value={editModel}
                onChange={(e) => setEditModel(e.target.value)}
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
                htmlFor="edit-agent-max-steps"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Max steps (1–50, optional)
              </label>
              <input
                id="edit-agent-max-steps"
                type="number"
                min={1}
                max={50}
                value={editMaxSteps === "" ? "" : editMaxSteps}
                onChange={(e) =>
                  setEditMaxSteps(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="Reserved for future tool use"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
              />
            </div>
            <div className="mb-4 flex items-center gap-2">
              <input
                id="edit-agent-thinking"
                type="checkbox"
                checked={editThinkingEnabled}
                onChange={(e) => setEditThinkingEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <label
                htmlFor="edit-agent-thinking"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Enable extended thinking (when supported by model)
              </label>
            </div>
            <div className="mb-4">
              <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Assigned tools (used when the Master invokes this sub-agent)
              </span>
              {availableTools.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {availableTools.map((tool) => (
                    <label
                      key={tool.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600"
                    >
                      <input
                        type="checkbox"
                        checked={editToolIds.includes(tool.id)}
                        onChange={(e) =>
                          setEditToolIds((prev) =>
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
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No tools yet. Create API tools in <Link href="/tools" className="underline hover:no-underline">Tools</Link> to assign them to sub-agents.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={updateSubmitting}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {updateSubmitting ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </FormCard>
        </form>
      )}

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading agents…</p>
      ) : unifiedList.length === 0 && !showCreateForm && editingId == null ? (
        <EmptyState
          message="No agents yet."
          actionLabel="Add agent"
          onAction={() => setShowCreateForm(true)}
        />
      ) : showCreateForm || editingId != null ? null : viewMode === "cards" ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {unifiedList.map((item) => {
            if (item.kind === "master") {
              const ma = item.data;
              const menu = (
                <DropdownMenu
                  isOpen={menuOpenId === ma.id}
                  onOpenChange={(open) => setMenuOpenId(open ? ma.id : null)}
                  triggerLabel="Master agent options"
                  actions={[
                    { label: "Edit", onClick: () => router.push(`/master/${ma.id}`) },
                    { label: "Duplicate", onClick: () => handleDuplicateMaster(ma) },
                    { label: "Delete", onClick: () => handleDeleteMaster(ma), destructive: true },
                  ]}
                />
              );
              const content = (
                <>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{ma.name}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {ma.model ?? "default"} · Updated {formatDate(ma.updatedAt)}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      Master agent
                    </span>
                  </div>
                </>
              );
              return (
                <ResourceCard key={`master-${ma.id}`} menu={menu} onClick={() => router.push(`/master/${ma.id}`)}>
                  {content}
                </ResourceCard>
              );
            }
            const a = item.data;
            const menu = (
              <DropdownMenu
                isOpen={menuOpenId === a.id}
                onOpenChange={(open) => setMenuOpenId(open ? a.id : null)}
                triggerLabel="Agent options"
                actions={[
                  { label: "Duplicate", onClick: () => handleDuplicate(a) },
                  { label: "Edit", onClick: () => startEdit(a) },
                  { label: "Delete", onClick: () => handleDelete(a.id), destructive: true },
                ]}
              />
            );
            const content = (
              <>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {a.name}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {a.model ? (
                    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {a.model}
                    </span>
                  ) : null}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {a.toolIds && a.toolIds.length > 0
                      ? `${a.toolIds.length} tool${a.toolIds.length === 1 ? "" : "s"}`
                      : "No tools"}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    · {formatDate(a.createdAt)}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    Agent
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {a.systemPrompt}
                </p>
              </>
            );
            return (
              <ResourceCard key={`agent-${a.id}`} menu={menu} onClick={() => startEdit(a)}>
                {content}
              </ResourceCard>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-2">
          {unifiedList.map((item) => {
            if (item.kind === "master") {
              const ma = item.data;
              const menu = (
                <DropdownMenu
                  isOpen={menuOpenId === ma.id}
                  onOpenChange={(open) => setMenuOpenId(open ? ma.id : null)}
                  triggerLabel="Master agent options"
                  actions={[
                    { label: "Edit", onClick: () => router.push(`/master/${ma.id}`) },
                    { label: "Duplicate", onClick: () => handleDuplicateMaster(ma) },
                    { label: "Delete", onClick: () => handleDeleteMaster(ma), destructive: true },
                  ]}
                />
              );
              const content = (
                <>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {ma.name}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {" "}
                    · {ma.model ?? "default"} · Updated {formatDate(ma.updatedAt)}
                  </span>
                  <span className="ml-2 inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    Master agent
                  </span>
                </>
              );
              return (
                <ResourceRow key={`master-${ma.id}`} menu={menu} onClick={() => router.push(`/master/${ma.id}`)}>
                  {content}
                </ResourceRow>
              );
            }
            const a = item.data;
            const menu = (
              <DropdownMenu
                isOpen={menuOpenId === a.id}
                onOpenChange={(open) => setMenuOpenId(open ? a.id : null)}
                triggerLabel="Agent options"
                actions={[
                  { label: "Duplicate", onClick: () => handleDuplicate(a) },
                  { label: "Edit", onClick: () => startEdit(a) },
                  { label: "Delete", onClick: () => handleDelete(a.id), destructive: true },
                ]}
              />
            );
            const content = (
              <>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {a.name}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {a.model ? ` · ${a.model}` : ""}
                  {a.toolIds && a.toolIds.length > 0
                    ? ` · ${a.toolIds.length} tool${a.toolIds.length === 1 ? "" : "s"}`
                    : " · No tools"}
                  {" · "}
                  {formatDate(a.createdAt)}
                </span>
                <span className="ml-2 inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  Agent
                </span>
                <p className="mt-0.5 line-clamp-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {a.systemPrompt}
                </p>
              </>
            );
            return (
              <ResourceRow key={`agent-${a.id}`} menu={menu} onClick={() => startEdit(a)}>
                {content}
              </ResourceRow>
            );
          })}
        </ul>
      )}
    </ResourcePageLayout>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-zinc-500 dark:text-zinc-400">Loading agents…</p>}>
      <AgentsPageContent />
    </Suspense>
  );
}
