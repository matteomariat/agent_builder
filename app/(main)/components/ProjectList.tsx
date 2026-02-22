"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DotsIcon } from "./ui/DotsIcon";
import { EmptyState } from "./resource-list";

type Project = {
  id: string;
  title: string;
  masterAgentId: string | null;
  masterAgentName: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!menuOpenId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpenId]);

  const startRename = (project: Project) => {
    setEditingId(project.id);
    setEditTitle(project.title);
    setMenuOpenId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const handleRename = async (id: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setProjects((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, title: data.title, updatedAt: data.updatedAt }
              : p
          )
        );
        setEditingId(null);
        setEditTitle("");
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete project "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setMenuOpenId(null);
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Loading projects…
      </p>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        message="No projects yet. Start a new chat to create one."
        actionLabel="New project"
        onAction={() => router.push("/chat/new")}
      />
    );
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <li
          key={project.id}
          className="relative flex flex-col rounded-xl border border-zinc-200 bg-white transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {editingId === project.id ? (
            <div className="flex flex-col gap-2 p-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(project.id);
                  if (e.key === "Escape") cancelRename();
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
                placeholder="Project name"
                autoFocus
                aria-label="Rename project"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRename(project.id)}
                  disabled={savingId === project.id || !editTitle.trim()}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                >
                  {savingId === project.id ? "…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelRename}
                  disabled={savingId === project.id}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <Link
                href={`/chat/${project.id}`}
                className="block min-w-0 flex-1 p-3 pr-10"
              >
                <span className="block truncate text-base font-medium text-zinc-900 dark:text-zinc-100">
                  {project.title}
                </span>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {project.masterAgentName ? (
                    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {project.masterAgentName}
                    </span>
                  ) : null}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(project.updatedAt)}
                  </span>
                </div>
              </Link>
              <div
                ref={menuOpenId === project.id ? menuRef : null}
                className="absolute right-1 top-1"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === project.id ? null : project.id);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:focus:ring-zinc-500"
                  aria-label="Project options"
                  aria-expanded={menuOpenId === project.id}
                >
                  <DotsIcon />
                </button>
                {menuOpenId === project.id && (
                  <div
                    className="absolute right-0 top-full z-10 mt-0.5 min-w-[140px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                    role="menu"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        startRename(project);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      role="menuitem"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(project.id, project.title);
                      }}
                      disabled={deletingId === project.id}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      role="menuitem"
                    >
                      {deletingId === project.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
