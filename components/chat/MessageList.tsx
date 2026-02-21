"use client";

import { UIMessage } from "ai";
import { useEffect, useRef } from "react";

interface MessageListProps {
  messages: UIMessage[];
  status: string;
}

export default function MessageList({ messages, status }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400">
          <svg className="w-10 h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">Send a message to get started.</p>
          <p className="text-xs mt-1">The master agent will respond and can edit the document.</p>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`
              max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
              ${message.role === "user"
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
              }
            `}
          >
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <span key={i} className="whitespace-pre-wrap">
                    {part.text}
                  </span>
                );
              }
              if (part.type.startsWith("tool-")) {
                const toolPart = part as { type: string; toolName?: string; state?: string };
                return (
                  <div key={i} className="flex items-center gap-1.5 text-xs opacity-70 mt-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    </svg>
                    <span>
                      {toolPart.toolName ?? part.type.replace("tool-", "")}
                      {toolPart.state === "input-available" ? "…" : " ✓"}
                    </span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      ))}

      {(status === "submitted" || status === "streaming") && (
        <div className="flex justify-start">
          <div className="bg-zinc-100 rounded-2xl rounded-bl-sm px-4 py-3">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
