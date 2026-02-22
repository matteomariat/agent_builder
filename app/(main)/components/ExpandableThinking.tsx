"use client";

type ExpandableThinkingProps = {
  text: string;
  state?: "streaming" | "done";
  defaultExpanded?: boolean;
};

/** Small thinking/reasoning icon (ChatGPT/Gemini-style) */
function ThinkingIcon({ className }: { className?: string }) {
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
      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

export function ExpandableThinking({
  text,
  state,
  defaultExpanded = false,
}: ExpandableThinkingProps) {
  const isStreaming = state === "streaming";

  return (
    <details
      className="group mt-1 first:mt-0.5"
      open={defaultExpanded}
    >
      <summary
        className="inline-flex min-h-[1.75rem] cursor-pointer list-none items-center gap-1.5 rounded-full border border-zinc-200/90 bg-zinc-100/80 px-2.5 py-1 text-left text-xs text-zinc-500 transition-colors hover:bg-zinc-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:border-zinc-600/70 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:focus-visible:ring-zinc-500/50 [&::-webkit-details-marker]:hidden"
        tabIndex={0}
        role="button"
        aria-expanded={defaultExpanded}
      >
        <ThinkingIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
        <span>Thinking</span>
        {isStreaming && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden />
        )}
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
      <div className="mt-1.5 rounded-md border border-zinc-200/80 bg-white/60 pl-2.5 pr-2 pb-2 pt-2 dark:border-zinc-600/50 dark:bg-zinc-900/40">
        <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {text || (isStreaming ? "…" : "(empty)")}
        </pre>
      </div>
    </details>
  );
}
