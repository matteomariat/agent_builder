"use client";

type EmptyStateProps = {
  message: string;
  actionLabel: string;
  onAction: () => void;
};

export function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-4 text-zinc-500 dark:text-zinc-400">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {actionLabel}
      </button>
    </div>
  );
}
