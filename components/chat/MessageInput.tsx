"use client";

import { useState, useRef } from "react";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
  hasMaster: boolean;
}

export default function MessageInput({ onSend, disabled, hasMaster }: MessageInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || disabled) return;
    onSend(text);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const placeholder = !hasMaster
    ? "Create a master agent first…"
    : disabled
    ? "Agent is responding…"
    : "Message the master agent… (Enter to send)";

  return (
    <div className="border-t border-zinc-100 px-3 py-3 flex-shrink-0">
      <div className="flex items-end gap-2 bg-zinc-50 rounded-xl border border-zinc-200 px-3 py-2 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || !hasMaster}
          rows={1}
          className="flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 resize-none focus:outline-none min-h-[24px]"
          style={{ height: "24px" }}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || disabled || !hasMaster}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 transition-colors"
          aria-label="Send"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
