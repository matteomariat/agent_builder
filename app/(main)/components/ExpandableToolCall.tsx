"use client";

import { getToolDisplayName } from "./chat-parts";

type ToolPart = {
  type: string;
  toolName?: string;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type ExpandableToolCallProps = {
  part: ToolPart;
};

function formatJson(value: unknown): string {
  if (value === undefined || value === null) return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getStatusLabel(state: string, errorText?: string): string {
  if (errorText || state === "output-error" || state === "output-denied") return "Error";
  if (state === "output-available" || state === "approval-responded") return "Done";
  if (state === "approval-requested") return "Approval requested";
  if (state === "input-streaming" || state === "input-available") return "…";
  return state;
}

function isErrorState(state: string, errorText?: string): boolean {
  return Boolean(errorText || state === "output-error" || state === "output-denied");
}

/** Wrench/tool icon (ChatGPT-style "tool call" label) */
function ToolIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function getInvokeAgentDisplayName(part: ToolPart): string | null {
  if (part.toolName !== "invoke_agent") return null;
  const out = part.output;
  if (out && typeof out === "object" && "agentName" in out && typeof (out as { agentName?: string }).agentName === "string") {
    return (out as { agentName: string }).agentName;
  }
  return null;
}

export function ExpandableToolCall({ part }: ExpandableToolCallProps) {
  const invokeAgentName = getInvokeAgentDisplayName(part);
  const displayName = invokeAgentName ?? getToolDisplayName(part);
  const status = getStatusLabel(part.state, part.errorText);
  const hasError = isErrorState(part.state, part.errorText);

  return (
    <details className="group mt-1 first:mt-0.5">
      <summary
        className="inline-flex min-h-[1.75rem] cursor-pointer list-none items-center gap-1.5 rounded-full border border-zinc-200/90 bg-zinc-100/80 px-2.5 py-1 text-left text-xs text-zinc-500 transition-colors hover:bg-zinc-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:border-zinc-600/70 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:focus-visible:ring-zinc-500/50 [&::-webkit-details-marker]:hidden"
        tabIndex={0}
        role="button"
      >
        <ToolIcon
          className={`h-3.5 w-3.5 shrink-0 ${hasError ? "text-red-500 dark:text-red-400" : "text-zinc-400 dark:text-zinc-500"}`}
        />
        <span className="shrink-0">{displayName}</span>
        <span
          className={`shrink-0 ${hasError ? "text-red-500 dark:text-red-400" : "text-zinc-400 dark:text-zinc-500"}`}
        >
          {status}
        </span>
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
      <div className="mt-1.5 rounded-md border border-zinc-200/80 bg-white/60 px-2.5 pb-2 pt-2 dark:border-zinc-600/50 dark:bg-zinc-900/40">
        <div className="space-y-1.5 text-[11px]">
          {part.input !== undefined && part.input !== null && (
            <div>
              <div className="mb-0.5 text-zinc-500 dark:text-zinc-400">Input</div>
              <pre className="max-h-32 overflow-auto rounded bg-black/[0.06] px-1.5 py-1 font-mono text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300">
                {formatJson(part.input)}
              </pre>
            </div>
          )}
          {part.errorText && (
            <div>
              <div className="mb-0.5 text-red-500 dark:text-red-400">Error</div>
              <pre className="max-h-32 overflow-auto rounded bg-red-50/80 px-1.5 py-1 font-mono text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {part.errorText}
              </pre>
            </div>
          )}
          {part.output !== undefined && part.output !== null && !part.errorText && (
            <div>
              <div className="mb-0.5 text-zinc-500 dark:text-zinc-400">Output</div>
              <pre className="max-h-32 overflow-auto rounded bg-black/[0.06] px-1.5 py-1 font-mono text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300">
                {formatJson(part.output)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
