"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { WorkingDocEditor } from "../../components/WorkingDocEditor";
import { MessageThinkingBlock, type MetaPart } from "../../components/MessageThinkingBlock";
import { isTextPart, isReasoningPart, isStepStartPart, isToolPart } from "../../components/chat-parts";

function getMessageText(m: { role: string; parts?: { type?: string; text?: string }[]; content?: string }): string {
  if ("parts" in m && Array.isArray(m.parts)) {
    return m.parts.map((p) => (p.type === "text" ? p.text ?? "" : "")).join("");
  }
  if (typeof (m as { content?: string }).content === "string") {
    return (m as { content: string }).content;
  }
  return "";
}

const markdownComponents: Parameters<typeof ReactMarkdown>[0]["components"] = {
  p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
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
  code: ({ className, children, ...props }) => {
    const isBlock = className != null;
    return (
      <code
        className={isBlock ? undefined : "rounded bg-black/10 px-1 font-mono text-sm dark:bg-white/10"}
        {...props}
      >
        {children}
      </code>
    );
  },
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1 border-l-2 border-zinc-300 pl-2 dark:border-zinc-600">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => <h1 className="mt-2 mb-1 text-base font-bold">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-2 mb-1 text-sm font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-1 mb-0.5 text-sm font-semibold">{children}</h3>,
};

type DocState = {
  content: string;
  lockHolder: "user" | "agent" | null;
  updatedAt: string | null;
};

const DEBOUNCE_MS = 800;
const LEFT_PANE_MIN = 280;
const LEFT_PANE_MAX = 600;
const LEFT_PANE_DEFAULT = 400;
const STORAGE_KEY = "chat-left-pane-width";

function getStoredLeftPaneWidth(): number {
  if (typeof window === "undefined") return LEFT_PANE_DEFAULT;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored != null) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n)) return Math.max(LEFT_PANE_MIN, Math.min(LEFT_PANE_MAX, n));
    }
  } catch {
    // ignore
  }
  return LEFT_PANE_DEFAULT;
}

const DEFAULT_PROJECT_TITLE = "New conversation";

export default function ChatPage() {
  const params = useParams();
  const conversationId = params?.conversationId as string;
  const [doc, setDoc] = useState<DocState>({ content: "", lockHolder: null, updatedAt: null });
  const [docLoading, setDocLoading] = useState(true);
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false);
  const [projectTitle, setProjectTitle] = useState(DEFAULT_PROJECT_TITLE);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleMirrorRef = useRef<HTMLSpanElement>(null);
  const [input, setInput] = useState("");
  const [leftPaneWidth, setLeftPaneWidth] = useState(LEFT_PANE_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);
  const [isMdUp, setIsMdUp] = useState(false);
  const docDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    setLeftPaneWidth(getStoredLeftPaneWidth());
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const fn = () => setIsMdUp(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

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
        const [msgRes, docRes, convRes] = await Promise.all([
          fetch(`/api/conversations/${conversationId}/messages`),
          fetch(`/api/conversations/${conversationId}/doc`),
          fetch(`/api/conversations/${conversationId}`),
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
        if (convRes.ok) {
          const convData = await convRes.json();
          const title = typeof convData.title === "string" && convData.title.trim() ? convData.title.trim() : DEFAULT_PROJECT_TITLE;
          setProjectTitle(title);
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

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      refetchDoc();
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, refetchDoc]);

  const handleDocChange = useCallback(
    (value: string) => {
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

  const getClampedWidth = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return leftPaneWidth;
    const rect = el.getBoundingClientRect();
    const maxByContainer = Math.floor(rect.width * 0.7);
    const maxW = Math.min(LEFT_PANE_MAX, maxByContainer);
    const raw = clientX - rect.left;
    return Math.max(LEFT_PANE_MIN, Math.min(maxW, raw));
  }, [leftPaneWidth]);

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => setLeftPaneWidth((w) => getClampedWidth(e.clientX));
    const onUp = () => setIsResizing(false);
    document.body.classList.add("select-none");
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.classList.remove("select-none");
      document.body.style.cursor = "";
    };
  }, [isResizing, getClampedWidth]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      const t = e.touches[0];
      if (t) setLeftPaneWidth((w) => getClampedWidth(t.clientX));
    };
    const onEnd = () => setIsResizing(false);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [isResizing, getClampedWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(leftPaneWidth));
    } catch {
      // ignore
    }
  }, [leftPaneWidth]);

  const startEditingTitle = useCallback(() => {
    if (!conversationId) return;
    setEditTitleValue(projectTitle);
    setIsEditingTitle(true);
  }, [conversationId, projectTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  // Shrink edit input width to text size (mirror span)
  useEffect(() => {
    if (!isEditingTitle) return;
    const input = titleInputRef.current;
    const mirror = titleMirrorRef.current;
    if (!input || !mirror) return;
    const updateWidth = () => {
      const w = mirror.scrollWidth;
      input.style.width = `${Math.max(24, w + 2)}px`;
    };
    const raf = requestAnimationFrame(() => {
      updateWidth();
    });
    const ro = new ResizeObserver(updateWidth);
    ro.observe(mirror);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [isEditingTitle, editTitleValue]);

  const saveTitle = useCallback(async () => {
    setIsEditingTitle(false);
    const trimmed = editTitleValue.trim();
    const newTitle = trimmed || DEFAULT_PROJECT_TITLE;
    if (newTitle === projectTitle) return;
    setProjectTitle(newTitle);
    if (!conversationId) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!res.ok) setProjectTitle(projectTitle);
    } catch {
      setProjectTitle(projectTitle);
    }
  }, [conversationId, editTitleValue, projectTitle]);

  const cancelEditingTitle = useCallback(() => {
    setIsEditingTitle(false);
    setEditTitleValue(projectTitle);
  }, [projectTitle]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveTitle();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEditingTitle();
      }
    },
    [saveTitle, cancelEditingTitle]
  );

  return (
    <div
      ref={containerRef}
      className="flex h-[calc(100dvh-3.5rem)] md:h-screen flex-col md:flex-row"
    >
      <aside
        className="flex w-full flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex-shrink-0"
        style={isMdUp ? { width: leftPaneWidth, flexShrink: 0 } : undefined}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <Link
            href="/"
            className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          {isEditingTitle ? (
            <span className="relative inline-flex min-w-0 max-w-full items-center">
              <span
                ref={titleMirrorRef}
                className="invisible absolute left-0 top-0 whitespace-pre text-sm font-medium"
                aria-hidden
              >
                {editTitleValue || "\u00a0"}
              </span>
              <input
                ref={titleInputRef}
                type="text"
                value={editTitleValue}
                onChange={(e) => setEditTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={handleTitleKeyDown}
                className="min-w-6 max-w-full shrink rounded border border-zinc-300 bg-transparent px-0.5 py-0 text-sm font-medium text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:text-zinc-300 dark:focus:border-zinc-500"
                style={{ width: "24px" }}
                aria-label="Project name"
              />
            </span>
          ) : (
            <button
              type="button"
              onClick={conversationId ? startEditingTitle : undefined}
              className="inline-block max-w-full truncate rounded px-0.5 py-0.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:outline-none focus:bg-zinc-100 focus:outline-none dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
              title="Edit project name"
            >
              {projectTitle}
            </button>
          )}
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
                      : "flex justify-start flex-col items-start"
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
                    for (const part of parts as { type?: string; text?: string; state?: string; toolName?: string; toolCallId?: string; input?: unknown; output?: unknown; errorText?: string }[]) {
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
                          <div className="chat-markdown">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                              {textContent}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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
      {isMdUp && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={leftPaneWidth}
          className="w-1.5 shrink-0 cursor-col-resize touch-none border-r border-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          onMouseDown={(e) => {
            e.preventDefault();
            handleResizeStart();
          }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) handleResizeStart();
          }}
        />
      )}
      <section className="flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        <div className="relative flex-1 overflow-hidden p-4">
          {docLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading doc…</p>
          ) : (
            <>
              <WorkingDocEditor
                value={doc.content}
                onChange={handleDocChange}
                readOnly={docReadOnly}
                placeholder="Shared doc. You and the agent can edit (not at the same time)."
                className="h-full focus-within:ring-2 focus-within:ring-zinc-400 dark:focus-within:ring-zinc-600"
              />
              {agentEditing && (
                <div
                  className="absolute inset-0 rounded-lg bg-white/60 dark:bg-zinc-900/60 pointer-events-none"
                  aria-hidden
                />
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
