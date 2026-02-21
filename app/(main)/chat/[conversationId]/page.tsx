"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type DocState = {
  content: string;
  lockHolder: "user" | "agent" | null;
  updatedAt: string | null;
};

const DEBOUNCE_MS = 800;

export default function ChatPage() {
  const params = useParams();
  const conversationId = params?.conversationId as string;
  const [doc, setDoc] = useState<DocState>({ content: "", lockHolder: null, updatedAt: null });
  const [docLoading, setDocLoading] = useState(true);
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false);
  const [input, setInput] = useState("");
  const docDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transport = useMemo(
    () =>
      conversationId
        ? new DefaultChatTransport({ api: `/api/conversations/${conversationId}/chat` })
        : undefined,
    [conversationId]
  );

  const { messages, sendMessage, status, setMessages, error: chatError } = useChat({
    id: conversationId,
    transport,
  });

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

  useEffect(() => {
    if (!conversationId) return;
    (async () => {
      try {
        const [msgRes, docRes] = await Promise.all([
          fetch(`/api/conversations/${conversationId}/messages`),
          fetch(`/api/conversations/${conversationId}/doc`),
        ]);
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          setMessages(
            msgData.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant" | "system",
              parts: [{ type: "text" as const, text: m.content }],
            }))
          );
        }
        setInitialMessagesLoaded(true);
        if (docRes.ok) {
          const docData = await docRes.json();
          setDoc({
            content: docData.content ?? "",
            lockHolder: docData.lockHolder ?? null,
            updatedAt: docData.updatedAt ?? null,
          });
        }
      } catch {
        setInitialMessagesLoaded(true);
      } finally {
        setDocLoading(false);
      }
    })();
  }, [conversationId, setMessages]);

  const refetchDoc = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}/doc`);
      if (res.ok) {
        const data = await res.json();
        setDoc({
          content: data.content ?? "",
          lockHolder: data.lockHolder ?? null,
          updatedAt: data.updatedAt ?? null,
        });
      }
    } catch {
      // ignore
    }
  }, [conversationId]);

  useEffect(() => {
    if (!isLoading && doc.lockHolder === "agent") {
      refetchDoc();
    }
  }, [isLoading, doc.lockHolder, refetchDoc]);

  const handleDocChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setDoc((d) => ({ ...d, content: value }));
      if (docDebounceRef.current) clearTimeout(docDebounceRef.current);
      docDebounceRef.current = setTimeout(async () => {
        if (!conversationId) return;
        try {
          const res = await fetch(`/api/conversations/${conversationId}/doc`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: value }),
          });
          if (res.status === 409) {
            const data = await res.json().catch(() => ({}));
            console.warn(data.error ?? "Doc locked");
          }
        } catch {
          // ignore
        } finally {
          docDebounceRef.current = null;
        }
      }, DEBOUNCE_MS);
    },
    [conversationId]
  );

  const agentEditing = doc.lockHolder === "agent" || isLoading;
  const docReadOnly = agentEditing;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:flex-row">
      <aside className="flex w-full flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:w-[400px] lg:w-[440px]">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <Link
            href="/"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Master agent
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {chatError && (
            <div
              className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200"
              role="alert"
            >
              {chatError.message}
            </div>
          )}
          {!conversationId ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Invalid conversation</p>
          ) : !initialMessagesLoaded ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Send a message to start. The agent can delegate to your agents and edit the working doc.
            </p>
          ) : (
            <ul className="space-y-4">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    }
                  >
                    <p className="whitespace-pre-wrap">
                      {"parts" in m && Array.isArray(m.parts)
                        ? m.parts.map((p: { type?: string; text?: string }) => (p.type === "text" ? p.text ?? "" : "")).join("")
                        : typeof (m as unknown as { content?: string }).content === "string"
                          ? (m as unknown as { content: string }).content
                          : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form
          onSubmit={handleSubmit}
          className="border-t border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message the Master agent…"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isLoading ? "…" : "Send"}
            </button>
          </div>
        </form>
      </aside>
      <section className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Working doc
          </h2>
          {agentEditing && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Agent is editing…
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden p-4">
          {docLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading doc…</p>
          ) : (
            <textarea
              value={doc.content}
              onChange={handleDocChange}
              readOnly={docReadOnly}
              placeholder="Shared doc. You and the agent can edit (not at the same time)."
              className="h-full w-full resize-none rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-400 dark:focus:ring-zinc-600 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
              spellCheck
            />
          )}
        </div>
      </section>
    </div>
  );
}
