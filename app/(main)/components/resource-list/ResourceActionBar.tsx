"use client";

import Link from "next/link";
import { ViewToggle } from "./ViewToggle";

type ViewMode = "cards" | "list";

type ResourceActionBarProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  addLabel: string;
  onAdd: () => void;
  settingsHref?: string;
  settingsLabel?: string;
  showAddButton?: boolean;
  showViewToggle?: boolean;
};

export function ResourceActionBar({
  viewMode,
  onViewModeChange,
  addLabel,
  onAdd,
  settingsHref,
  settingsLabel,
  showAddButton = true,
  showViewToggle = true,
}: ResourceActionBarProps) {
  const primaryButtonClass =
    "inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";
  const secondaryButtonClass =
    "inline-flex items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showViewToggle && (
        <ViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
      )}
      <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
        {settingsHref != null && settingsLabel != null && (
          <Link href={settingsHref} className={secondaryButtonClass}>
            {settingsLabel}
          </Link>
        )}
        {showAddButton && (
          <button type="button" onClick={onAdd} className={primaryButtonClass}>
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}
