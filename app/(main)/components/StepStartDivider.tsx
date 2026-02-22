"use client";

type StepStartDividerProps = {
  stepIndex?: number;
};

/** Minimal step separator – only shown inside expanded Thinking, not at first glance */
export function StepStartDivider({ stepIndex }: StepStartDividerProps) {
  return (
    <div
      className="mt-2 flex items-center gap-2 text-[10px] text-zinc-400 first:mt-0 dark:text-zinc-500"
      role="separator"
      aria-label={stepIndex != null ? `Step ${stepIndex + 1}` : "Step"}
    >
      <span className="h-px flex-1 bg-zinc-200/70 dark:bg-zinc-600/50" />
      <span className="shrink-0 select-none">Step {stepIndex != null ? stepIndex + 1 : ""}</span>
      <span className="h-px flex-1 bg-zinc-200/70 dark:bg-zinc-600/50" />
    </div>
  );
}
