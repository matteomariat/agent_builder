"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export default function KnowledgeDefaultsPage() {
  const [guidance, setGuidance] = useState("");
  const [rules, setRules] = useState("");
  const [style, setStyle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/knowledge?ownerType=default")
      .then((r) => (r.ok ? r.json() : []))
      .then((items: { type: string; content: string }[]) => {
        if (cancelled) return;
        const byType: Record<string, string[]> = { guidance: [], rules: [], style: [] };
        for (const item of items) {
          if (item.type in byType) {
            byType[item.type as keyof typeof byType].push((item.content ?? "").trim());
          }
        }
        setGuidance(byType.guidance.join("\n\n"));
        setRules(byType.rules.join("\n\n"));
        setStyle(byType.style.join("\n\n"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setError(null);
      try {
        const listRes = await fetch("/api/knowledge?ownerType=default");
        if (listRes.ok) {
          const items: { id: string }[] = await listRes.json();
          for (const item of items) {
            await fetch(`/api/knowledge/${item.id}`, { method: "DELETE" });
          }
        }
        for (const { type, content } of [
          { type: "guidance" as const, content: guidance.trim() },
          { type: "rules" as const, content: rules.trim() },
          { type: "style" as const, content: style.trim() },
        ]) {
          if (content) {
            await fetch("/api/knowledge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ownerType: "default",
                ownerId: null,
                type,
                content,
              }),
            });
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [guidance, rules, style]
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/agents" className="hover:text-zinc-700 dark:hover:text-zinc-300">
          Agents
        </Link>
        <span aria-hidden>/</span>
        <span>Knowledge defaults</span>
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Knowledge defaults
      </h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">
        Default guidance, rules, and style used by all project types and sub-agents when they use the default. Override these per project type or per sub-agent as needed.
      </p>

      {error && (
        <div
          className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-4">
            <label
              htmlFor="default-guidance"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Guidance (high-level direction, goals)
            </label>
            <textarea
              id="default-guidance"
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="Default guidance for all agents…"
              rows={3}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div className="mb-4">
            <label
              htmlFor="default-rules"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Rules (must-follow constraints)
            </label>
            <textarea
              id="default-rules"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="Default rules for all agents…"
              rows={3}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="default-style"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Style (tone, format, voice)
            </label>
            <textarea
              id="default-style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="Default style for all agents…"
              rows={3}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "Saving…" : "Save defaults"}
            </button>
            <Link
              href="/agents"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Back to Agents
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
