"use client";

type ViewMode = "cards" | "list";

type ViewToggleProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
};

function CardsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  const base =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500";
  const active =
    "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";
  const inactive =
    "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300";

  return (
    <span className="inline-flex" role="group" aria-label="View mode">
      <button
        type="button"
        onClick={() => onViewModeChange("cards")}
        className={`${base} rounded-r-none ${viewMode === "cards" ? active : inactive}`}
        aria-label="View as cards"
        aria-pressed={viewMode === "cards"}
      >
        <CardsIcon className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onViewModeChange("list")}
        className={`${base} rounded-l-none border-l-0 ${viewMode === "list" ? active : inactive}`}
        aria-label="View as list"
        aria-pressed={viewMode === "list"}
      >
        <ListIcon className="size-4" />
      </button>
    </span>
  );
}
