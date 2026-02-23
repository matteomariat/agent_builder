"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageThinkingBlock, type MetaPart } from "./MessageThinkingBlock";
import { isTextPart, isReasoningPart, isStepStartPart, isToolPart } from "./chat-parts";

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

export type ChatPaneProps = {
  conversationId: string | null;
  title?: string;
  placeholder?: string;
  onInitialMessagesLoaded?: () => void;
  onToolResult?: (toolName: string, result: unknown) => void;
  className?: string;
};

export function ChatPane({
  conversationId,
  title = "Chat",
  placeholder = "Send a message…",
  onInitialMessagesLoaded,
  onToolResult,
  className = "",
}: ChatPaneProps) {
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  useEffect(() => {
    setMessagesLoaded(false);
  }, [conversationId]);
  const transport = useMemo(
    () =>
      conversationId
        ? new DefaultChatTransport({ api: `/api/conversations/${conversationId}/chat` })
        : undefined,
    [conversationId]
  );

  const { messages, sendMessage, status, setMessages, error: chatError } = useChat({
    id: conversationId ?? undefined,
    transport,
  });

  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";
  const lastProcessedRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

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
    if (messages.length === 0 && !messagesLoaded) return;
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, messagesLoaded]);

  useEffect(() => {
    if (!conversationId) return;
    (async () => {
      try {
        const msgRes = await fetch(`/api/conversations/${conversationId}/messages`);
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
        setMessagesLoaded(true);
        onInitialMessagesLoaded?.();
      } catch {
        setMessagesLoaded(true);
        onInitialMessagesLoaded?.();
      }
    })();
  }, [conversationId, setMessages, onInitialMessagesLoaded]);

  const TOOLS_THAT_AFFECT_UI = [
    "create_agent",
    "update_agent",
    "focus_agent",
    "create_knowledge",
    "update_knowledge",
    "delete_knowledge",
    "set_agent_file_assignments",
  ];

  useEffect(() => {
    if (!onToolResult || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant") return;
    const parts = "parts" in last && Array.isArray(last.parts) ? last.parts : [];
    const key = `${last.id}-${parts.length}`;
    if (lastProcessedRef.current === key) return;
    let didNotify = false;
    for (const part of parts as { type?: string; toolName?: string; output?: unknown; state?: string }[]) {
      if (!isToolPart(part as { type: string }) || (part as { output?: unknown }).output == null) continue;
      const state = (part as { state?: string }).state;
      if (state === "input-streaming" || state === "input-available") continue;
      const toolName =
        (part as { toolName?: string }).toolName ??
        (typeof (part as { type?: string }).type === "string" && (part as { type: string }).type.startsWith("tool-")
          ? (part as { type: string }).type.slice(5)
          : "");
      const output = (part as { output?: unknown }).output;
      if (!TOOLS_THAT_AFFECT_UI.includes(toolName)) continue;
      const obj = output && typeof output === "object" ? (output as Record<string, unknown>) : null;
      if (toolName === "create_agent" || toolName === "update_agent") {
        if (obj?.id) {
          onToolResult(toolName, output);
          didNotify = true;
        }
      } else if (toolName === "focus_agent") {
        const agentId = obj?.agentId ?? obj?.id;
        if (typeof agentId === "string") {
          onToolResult(toolName, output);
          didNotify = true;
        }
      } else {
        onToolResult(toolName, output);
        didNotify = true;
      }
    }
    if (didNotify) lastProcessedRef.current = key;
  }, [messages, onToolResult]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {title ? (
        <div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</h2>
        </div>
      ) : null}
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
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No conversation</p>
        ) : !messagesLoaded ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{placeholder}</p>
        ) : (
          <>
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
                  for (const part of parts as { type?: string; text?: string; toolName?: string; toolCallId?: string; input?: unknown; output?: unknown; errorText?: string }[]) {
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
          <div ref={bottomRef} aria-hidden="true" />
          </>
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-800 shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
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
    </div>
  );
}

