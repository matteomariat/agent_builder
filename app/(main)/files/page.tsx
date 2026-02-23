"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ResourcePageLayout,
  ResourceActionBar,
  ResourceCard,
  ResourceRow,
  EmptyState,
  DropdownMenu,
  Modal,
} from "@/app/(main)/components/resource-list";

const VIEW_MODE_KEY = "resource-view-files";

type FileRecord = {
  id: string;
  filename: string;
  mimeType: string;
  createdAt: string;
};

const EDITABLE_EXTENSIONS = [".md", ".txt", ".csv"];

function isEditable(f: FileRecord): boolean {
  const ext = f.filename.toLowerCase().slice(f.filename.lastIndexOf("."));
  return EDITABLE_EXTENSIONS.includes(ext);
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRenameId, setSavingRenameId] = useState<string | null>(null);
  const [editFileId, setEditFileId] = useState<string | null>(null);
  const [editFilename, setEditFilename] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [assignFileId, setAssignFileId] = useState<string | null>(null);
  const [assignFilename, setAssignFilename] = useState("");
  const [masterOptions, setMasterOptions] = useState<{ id: string; name: string }[]>([]);
  const [agentOptions, setAgentOptions] = useState<{ id: string; name: string }[]>([]);
  const [assignMasterIds, setAssignMasterIds] = useState<string[]>([]);
  const [assignAgentIds, setAssignAgentIds] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [addFileModalOpen, setAddFileModalOpen] = useState(false);
  const [addFileUploadedId, setAddFileUploadedId] = useState<string | null>(null);
  const [addFileFilename, setAddFileFilename] = useState("");
  const [addFileContent, setAddFileContent] = useState("");
  const [addFileEditable, setAddFileEditable] = useState(false);
  const [addFileMasterIds, setAddFileMasterIds] = useState<string[]>([]);
  const [addFileAgentIds, setAddFileAgentIds] = useState<string[]>([]);
  const [addFileOptions, setAddFileOptions] = useState<{ masters: { id: string; name: string }[]; agents: { id: string; name: string }[] }>({ masters: [], agents: [] });
  const [addFileOptionsLoading, setAddFileOptionsLoading] = useState(false);
  const [addFileSaving, setAddFileSaving] = useState(false);

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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/files");
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();
      setFiles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    if (!editFileId) return;
    setEditLoading(true);
    setEditContent("");
    setEditFilename("");
    let cancelled = false;
    fetch(`/api/files/${editFileId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load file");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setEditFilename(data.filename ?? "");
          setEditContent(data.textContent ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load file content");
      })
      .finally(() => {
        if (!cancelled) setEditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editFileId]);

  useEffect(() => {
    if (!assignFileId) return;
    setAssignLoading(true);
    let cancelled = false;
    Promise.all([
      fetch("/api/master-agents").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/agents").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/files/${assignFileId}/assignments`).then((r) => (r.ok ? r.json() : { assignments: [] })),
    ])
      .then(([masters, agents, { assignments }]) => {
        if (cancelled) return;
        setMasterOptions(Array.isArray(masters) ? masters.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })) : []);
        setAgentOptions(Array.isArray(agents) ? agents.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })) : []);
        const list = Array.isArray(assignments) ? assignments : [];
        setAssignMasterIds(list.filter((a: { assigneeType: string }) => a.assigneeType === "master").map((a: { assigneeId: string }) => a.assigneeId));
        setAssignAgentIds(list.filter((a: { assigneeType: string }) => a.assigneeType === "agent").map((a: { assigneeId: string }) => a.assigneeId));
      })
      .finally(() => {
        if (!cancelled) setAssignLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignFileId]);

  useEffect(() => {
    if (!addFileModalOpen) return;
    setAddFileUploadedId(null);
    setAddFileFilename("");
    setAddFileContent("");
    setAddFileEditable(false);
    setAddFileMasterIds([]);
    setAddFileAgentIds([]);
    setAddFileOptionsLoading(true);
    let cancelled = false;
    Promise.all([
      fetch("/api/master-agents").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/agents").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([masters, agents]) => {
        if (cancelled) return;
        setAddFileOptions({
          masters: Array.isArray(masters) ? masters.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })) : [],
          agents: Array.isArray(agents) ? agents.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })) : [],
        });
      })
      .finally(() => {
        if (!cancelled) setAddFileOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addFileModalOpen]);

  const openAssign = useCallback((f: FileRecord) => {
    setMenuOpenId(null);
    setAssignFileId(f.id);
    setAssignFilename(f.filename);
  }, []);

  const closeAssign = useCallback(() => {
    setAssignFileId(null);
  }, []);

  const handleSaveAssign = useCallback(async () => {
    if (!assignFileId) return;
    setAssignSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${assignFileId}/assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterIds: assignMasterIds, agentIds: assignAgentIds }),
      });
      if (!res.ok) throw new Error("Failed to save assignments");
      closeAssign();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setAssignSaving(false);
    }
  }, [assignFileId, assignMasterIds, assignAgentIds, closeAssign]);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (![".md", ".csv", ".txt", ".pdf"].includes(ext)) {
        setError("Allowed types: .md, .csv, .txt, .pdf");
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Upload failed");
        }
        await fetchFiles();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [fetchFiles]
  );

  const handleAddFileUpload = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (![".md", ".csv", ".txt", ".pdf"].includes(ext)) {
      setError("Allowed types: .md, .csv, .txt, .pdf");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      const editable = [".md", ".txt", ".csv"].includes(ext);
      setAddFileUploadedId(data.id);
      setAddFileFilename(data.filename ?? file.name);
      setAddFileEditable(editable);
      if (editable && data.textContent != null) {
        setAddFileContent(data.textContent);
      } else if (editable) {
        const getRes = await fetch(`/api/files/${data.id}`);
        if (getRes.ok) {
          const fileData = await getRes.json();
          setAddFileContent(fileData.textContent ?? "");
        } else {
          setAddFileContent("");
        }
      } else {
        setAddFileContent("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const closeAddFileModal = useCallback(() => {
    setAddFileModalOpen(false);
    setAddFileUploadedId(null);
    setAddFileFilename("");
    setAddFileContent("");
    setAddFileEditable(false);
    setAddFileMasterIds([]);
    setAddFileAgentIds([]);
  }, []);

  const handleAddFileSave = useCallback(async () => {
    if (!addFileUploadedId) return;
    setAddFileSaving(true);
    setError(null);
    try {
      if (addFileEditable) {
        const patchRes = await fetch(`/api/files/${addFileUploadedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ textContent: addFileContent }),
        });
        if (!patchRes.ok) throw new Error("Failed to save content");
      }
      await fetch(`/api/files/${addFileUploadedId}/assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterIds: addFileMasterIds, agentIds: addFileAgentIds }),
      });
      closeAddFileModal();
      await fetchFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setAddFileSaving(false);
    }
  }, [addFileUploadedId, addFileEditable, addFileContent, addFileMasterIds, addFileAgentIds, closeAddFileModal, fetchFiles]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const openRename = (f: FileRecord) => {
    setRenamingId(f.id);
    setRenameValue(f.filename);
    setMenuOpenId(null);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const handleRename = useCallback(
    async (id: string) => {
      const trimmed = renameValue.trim();
      if (!trimmed) return;
      setSavingRenameId(id);
      try {
        const res = await fetch(`/api/files/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: trimmed }),
        });
        if (res.ok) {
          setFiles((prev) =>
            prev.map((file) =>
              file.id === id ? { ...file, filename: trimmed } : file
            )
          );
          setRenamingId(null);
          setRenameValue("");
        }
      } finally {
        setSavingRenameId(null);
      }
    },
    [renameValue]
  );

  const handleRemove = useCallback(
    async (id: string, filename: string) => {
      if (!confirm(`Remove "${filename}"? This cannot be undone.`)) return;
      setDeletingId(id);
      setMenuOpenId(null);
      try {
        const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
        if (res.ok) {
          setFiles((prev) => prev.filter((f) => f.id !== id));
        } else {
          setError("Failed to remove file");
        }
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  const openEdit = (f: FileRecord) => {
    setEditFileId(f.id);
    setMenuOpenId(null);
  };

  const closeEdit = () => {
    setEditFileId(null);
    setEditContent("");
    setEditFilename("");
  };

  const handleSaveEdit = useCallback(async () => {
    if (!editFileId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/files/${editFileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textContent: editContent }),
      });
      if (res.ok) {
        closeEdit();
        await fetchFiles();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save");
      }
    } finally {
      setEditSaving(false);
    }
  }, [editFileId, editContent, fetchFiles]);

  const buildFileActions = useCallback(
    (f: FileRecord) => {
      const actions = [
        ...(isEditable(f) ? [{ label: "Edit" as const, onClick: () => openEdit(f) }] : []),
        { label: "Rename" as const, onClick: () => openRename(f) },
        { label: "Assign to…" as const, onClick: () => openAssign(f) },
        { label: "Remove" as const, onClick: () => handleRemove(f.id, f.filename), destructive: true as const },
      ];
      return actions;
    },
    [openEdit, openAssign, handleRemove]
  );

  const renameFormJsx = (f: FileRecord) =>
    renamingId === f.id ? (
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename(f.id);
            if (e.key === "Escape") cancelRename();
          }}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
          placeholder="Filename"
          autoFocus
          aria-label="Rename file"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleRename(f.id)}
            disabled={savingRenameId === f.id || !renameValue.trim()}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
          >
            {savingRenameId === f.id ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={cancelRename}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
        </div>
      </div>
    ) : undefined;

  return (
    <ResourcePageLayout
      title="Files"
      description="Upload .md, .csv, .txt, or .pdf files. They can be used by agents for research."
      error={error}
      actionBar={
        <ResourceActionBar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          addLabel="Upload file"
          onAdd={() => setAddFileModalOpen(true)}
          showAddButton={true}
        />
      }
    >
      <Modal
        open={addFileModalOpen}
        onClose={closeAddFileModal}
        title={addFileUploadedId ? `Add file: ${addFileFilename || "…"}` : "Add file"}
        maxWidth="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={closeAddFileModal}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {addFileUploadedId ? "Close" : "Cancel"}
            </button>
            {addFileUploadedId && (
              <button
                type="button"
                onClick={handleAddFileSave}
                disabled={addFileSaving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {addFileSaving ? "Saving…" : "Save"}
              </button>
            )}
          </>
        }
      >
        {!addFileUploadedId ? (
          <div
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleAddFileUpload(file);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver
                ? "border-zinc-400 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            <input
              type="file"
              id="add-file-upload"
              accept=".md,.csv,.txt,.pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAddFileUpload(file);
                e.target.value = "";
              }}
            />
            <label
              htmlFor="add-file-upload"
              className="flex cursor-pointer flex-col items-center gap-2 sm:flex-row sm:justify-center"
            >
              <span className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                {uploading ? "Uploading…" : "Choose file"}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                or drag and drop
              </span>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            {addFileEditable ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Content (edit below)
                </label>
                <textarea
                  value={addFileContent}
                  onChange={(e) => setAddFileContent(e.target.value)}
                  className="h-[40vh] min-h-[200px] w-full resize-y rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-400 dark:focus:ring-zinc-600"
                  placeholder="File content…"
                  spellCheck
                  aria-label="File content"
                />
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                PDF uploaded. You can assign this file to master agents or sub-agents below.
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Master agents (research tool will use these files)
                </label>
                {addFileOptionsLoading ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
                ) : addFileOptions.masters.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No master agents. <Link href="/agents?create=master" className="underline">Create one</Link>.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {addFileOptions.masters.map((m) => (
                      <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600">
                        <input
                          type="checkbox"
                          checked={addFileMasterIds.includes(m.id)}
                          onChange={(e) =>
                            setAddFileMasterIds((prev) =>
                              e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                            )
                          }
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        <span className="text-sm text-zinc-900 dark:text-zinc-100">{m.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Sub-agents
                </label>
                {addFileOptionsLoading ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
                ) : addFileOptions.agents.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No sub-agents. <Link href="/agents" className="underline">Create one</Link>.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {addFileOptions.agents.map((a) => (
                      <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600">
                        <input
                          type="checkbox"
                          checked={addFileAgentIds.includes(a.id)}
                          onChange={(e) =>
                            setAddFileAgentIds((prev) =>
                              e.target.checked ? [...prev, a.id] : prev.filter((id) => id !== a.id)
                            )
                          }
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        <span className="text-sm text-zinc-900 dark:text-zinc-100">{a.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading files…</p>
      ) : files.length === 0 ? (
        <EmptyState
          message="No files yet. Upload a file to use with agents."
          actionLabel="Upload file"
          onAction={() => setAddFileModalOpen(true)}
        />
      ) : viewMode === "cards" ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {files.map((f) => {
            const isRenaming = renamingId === f.id;
            const menu = (
              <DropdownMenu
                isOpen={menuOpenId === f.id}
                onOpenChange={(open) => setMenuOpenId(open ? f.id : null)}
                triggerLabel="File options"
                actions={buildFileActions(f)}
              />
            );
            const content = (
              <>
                <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                  {f.filename}
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {new Date(f.createdAt).toLocaleDateString()}
                </p>
              </>
            );
            return (
              <ResourceCard
                key={f.id}
                menu={menu}
                editForm={renameFormJsx(f)}
                isEditing={isRenaming}
                onClick={() => (isEditable(f) ? openEdit(f) : openRename(f))}
              >
                {content}
              </ResourceCard>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => {
            const isRenaming = renamingId === f.id;
            const menu = (
              <DropdownMenu
                isOpen={menuOpenId === f.id}
                onOpenChange={(open) => setMenuOpenId(open ? f.id : null)}
                triggerLabel="File options"
                actions={buildFileActions(f)}
              />
            );
            const content = (
              <>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-900 dark:text-zinc-100">
                  {f.filename}
                </span>
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(f.createdAt).toLocaleDateString()}
                </span>
              </>
            );
            return (
              <ResourceRow
                key={f.id}
                menu={menu}
                editForm={renameFormJsx(f)}
                isEditing={isRenaming}
                onClick={() => (isEditable(f) ? openEdit(f) : openRename(f))}
              >
                {content}
              </ResourceRow>
            );
          })}
        </ul>
      )}

      {editFileId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-file-title"
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <h2
                id="edit-file-title"
                className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Edit: {editFilename || "…"}
              </h2>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Close"
              >
                <span className="sr-only">Close</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              {editLoading ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Loading…
                </p>
              ) : (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="h-[60vh] min-h-[200px] w-full resize-y rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-400 dark:focus:ring-zinc-600"
                  placeholder="File content…"
                  spellCheck
                  aria-label="File content"
                />
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editLoading || editSaving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignFileId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-file-title"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <h2 id="assign-file-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Assign to: {assignFilename || "…"}
              </h2>
              <button
                type="button"
                onClick={closeAssign}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
              {assignLoading ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Master agents (research tool will use these files)
                    </label>
                    {masterOptions.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">No master agents. <Link href="/agents?create=master" className="underline">Create one</Link>.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {masterOptions.map((m) => (
                          <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600">
                            <input
                              type="checkbox"
                              checked={assignMasterIds.includes(m.id)}
                              onChange={(e) =>
                                setAssignMasterIds((prev) =>
                                  e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                                )
                              }
                              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                            />
                            <span className="text-sm text-zinc-900 dark:text-zinc-100">{m.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Sub-agents
                    </label>
                    {agentOptions.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">No sub-agents. <Link href="/agents" className="underline">Create one</Link>.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {agentOptions.map((a) => (
                          <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600">
                            <input
                              type="checkbox"
                              checked={assignAgentIds.includes(a.id)}
                              onChange={(e) =>
                                setAssignAgentIds((prev) =>
                                  e.target.checked ? [...prev, a.id] : prev.filter((id) => id !== a.id)
                                )
                              }
                              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                            />
                            <span className="text-sm text-zinc-900 dark:text-zinc-100">{a.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <button
                type="button"
                onClick={closeAssign}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAssign}
                disabled={assignLoading || assignSaving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {assignSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ResourcePageLayout>
  );
}
