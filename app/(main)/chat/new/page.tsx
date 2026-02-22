"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type MasterAgent = {
  id: string;
  name: string;
  model: string | null;
  updatedAt: string | null;
};

export default function NewChatPage() {
  const router = useRouter();
  const [list, setList] = useState<MasterAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMasterAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/master-agents");
      if (!res.ok) throw new Error("Failed to load project types");
      const data = await res.json();
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterAgents();
  }, [fetchMasterAgents]);

  const startProject = async (masterAgentId: string) => {
    setCreatingId(masterAgentId);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New conversation",
          masterAgentId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create project");
      }
      const data = await res.json();
      router.replace(`/chat/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
      setCreatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-zinc-500 dark:text-zinc-400">Loading project types…</p>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          New project
        </h1>
        <p className="mb-6 text-zinc-600 dark:text-zinc-400">
          Create a Master agent in Agents first. Then you can start a new project by choosing that type.
        </p>
        <Link
          href="/agents"
          className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Agents
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        New project
      </h1>
      <p className="mb-8 text-zinc-600 dark:text-zinc-400">
        Choose a project type to start chatting. Each type uses its own master / project manager agent.
      </p>

      {error && (
        <div
          className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {list.map((ma) => (
          <li
            key={ma.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <button
              type="button"
              onClick={() => startProject(ma.id)}
              disabled={creatingId !== null}
              className="w-full text-left"
            >
              <span className="block text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {ma.name}
              </span>
              <span className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">
                {ma.model ?? "default"}
              </span>
              {creatingId === ma.id && (
                <span className="mt-2 block text-sm text-zinc-500 dark:text-zinc-400">
                  Creating…
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
