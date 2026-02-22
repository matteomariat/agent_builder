"use client";

import { useRef, useEffect } from "react";
import { DotsIcon } from "@/app/(main)/components/ui/DotsIcon";

export type DropdownAction = {
  label: string;
  onClick: () => void;
  destructive?: boolean;
};

type DropdownMenuProps = {
  actions: DropdownAction[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel?: string;
  children?: React.ReactNode;
};

export function DropdownMenu({
  actions,
  isOpen,
  onOpenChange,
  triggerLabel = "Options",
  children,
}: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen, onOpenChange]);

  return (
    <div ref={menuRef} className="relative">
      {children ?? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenChange(!isOpen);
          }}
          className="flex h-10 min-h-[44px] w-10 min-w-[44px] items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:focus:ring-zinc-500"
          aria-label={triggerLabel}
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <DotsIcon className="size-5" />
        </button>
      )}
      {isOpen && (
        <div
          className="absolute right-0 top-full z-10 mt-0.5 min-w-[140px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          role="menu"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                action.onClick();
                onOpenChange(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                action.destructive
                  ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  : "text-zinc-700 dark:text-zinc-200"
              }`}
              role="menuitem"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
