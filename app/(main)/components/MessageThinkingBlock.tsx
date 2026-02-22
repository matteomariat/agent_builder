"use client";

import { ExpandableToolCall } from "./ExpandableToolCall";
import { StepStartDivider } from "./StepStartDivider";
import { isReasoningPart, isStepStartPart, isToolPart } from "./chat-parts";

export type MetaPart =
  | { type: "reasoning"; text: string; state?: "streaming" | "done" }
  | { type: "step-start" }
  | {
      type: string;
      toolName?: string;
      toolCallId: string;
      state: string;
      input?: unknown;
      output?: unknown;
      errorText?: string;
    };

type MessageThinkingBlockProps = {
  parts: MetaPart[];
};

/** Single "Thinking" pill above the agent bubble; expand to see steps, reasoning, tool calls. */
export function MessageThinkingBlock({ parts }: MessageThinkingBlockProps) {
  if (parts.length === 0) return null;

  let stepIndex = -1;

  return (
    <details className="group w-fit">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1.5 py-0.5 text-left text-xs text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400/50 dark:text-zinc-400 dark:focus-visible:ring-zinc-500/50 [&::-webkit-details-marker]:hidden"
        tabIndex={0}
        role="button"
      >
        <svg
          className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span>Thinking</span>
        <svg
          className="ml-0.5 h-3 w-3 shrink-0 transition-transform text-zinc-400 group-open:rotate-180 dark:text-zinc-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="mt-1.5 w-full max-w-[min(85vw,42rem)] rounded-md border border-zinc-200/80 bg-white/60 px-2.5 pb-2 pt-2 dark:border-zinc-600/50 dark:bg-zinc-900/40">
        <div className="space-y-1.5">
          {parts.map((part, i) => {
            if (isStepStartPart(part as { type: string })) {
              stepIndex += 1;
              return <StepStartDivider key={i} stepIndex={stepIndex} />;
            }
            if (isReasoningPart(part as { type: string; text?: string })) {
              const p = part as { text: string; state?: "streaming" | "done" };
              return (
                <div key={i} className="rounded bg-zinc-50/80 px-2 py-1.5 dark:bg-zinc-800/50">
                  <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {p.text || (p.state === "streaming" ? "…" : "")}
                  </pre>
                </div>
              );
            }
            if (isToolPart(part as { type: string })) {
              const p = part as {
                type: string;
                toolName?: string;
                toolCallId: string;
                state: string;
                input?: unknown;
                output?: unknown;
                errorText?: string;
              };
              return (
                <ExpandableToolCall
                  key={i}
                  part={{
                    type: p.type,
                    toolName: p.toolName,
                    toolCallId: p.toolCallId ?? "",
                    state: p.state ?? "input-available",
                    input: p.input,
                    output: p.output,
                    errorText: p.errorText,
                  }}
                />
              );
            }
            return null;
          })}
        </div>
      </div>
    </details>
  );
}
