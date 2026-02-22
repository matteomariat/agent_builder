"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CloseIcon,
  ProjectIcon,
  FilesIcon,
  AgentsIcon,
  ToolsIcon,
  BuilderIcon,
  NewProjectIcon,
  MenuIcon,
} from "./ui/NavIcons";

const navItems = [
  { href: "/", label: "Project", Icon: ProjectIcon },
  { href: "/files", label: "Files", Icon: FilesIcon },
  { href: "/agents", label: "Agents", Icon: AgentsIcon },
  { href: "/tools", label: "Tools", Icon: ToolsIcon },
  { href: "/builder", label: "AI Builder", Icon: BuilderIcon },
] as const;

function NavContent({
  onNavigate,
  className = "",
  compact = false,
}: {
  onNavigate?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();

  const linkBase = compact
    ? "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
    : "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900";
  const linkInactive =
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";
  const linkActive =
    "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/chat/new") return pathname === "/chat/new";
    if (href.startsWith("/chat")) return pathname.startsWith("/chat");
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {!compact && (
        <span
          className={`flex min-h-[44px] items-center rounded-lg px-3 py-2.5 text-lg font-semibold text-zinc-900 dark:text-zinc-100 ${className}`}
        >
          CSales Agents
        </span>
      )}
      <nav className="flex flex-1 flex-col pt-6" aria-label="Main">
        <ul className="flex flex-col gap-1">
          {navItems.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  title={compact ? label : undefined}
                  className={`${linkBase} ${active ? linkActive : linkInactive}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon />
                  {!compact && <span>{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto pt-6">
          <Link
            href="/chat/new"
            onClick={onNavigate}
            title={compact ? "New project" : undefined}
            className={`${linkBase} flex items-center justify-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 ${compact ? "gap-0" : ""}`}
            aria-current={pathname === "/chat/new" ? "page" : undefined}
          >
            <NewProjectIcon />
            {!compact && <span>New project</span>}
          </Link>
        </div>
      </nav>
    </>
  );
}

const iconClass = "size-5 shrink-0";

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? iconClass}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? iconClass}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
        'a[href="/"]'
      );
      firstFocusable?.focus();
    } else {
      if (wasOpenRef.current) hamburgerRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 md:hidden">
        <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          CSales Agents
        </span>
        <button
          ref={hamburgerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
          aria-expanded={open}
          aria-controls="sidebar-drawer"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <MenuIcon />
        </button>
      </header>

      {/* Desktop fixed sidebar */}
      <aside
        className={`fixed left-0 top-0 z-10 hidden h-full flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex transition-[width] duration-200 ease-out ${
          collapsed ? "w-16 p-2" : "w-[240px] p-4"
        }`}
        aria-label="Main navigation"
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          <NavContent compact={collapsed} />
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mt-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRightIcon />
            ) : (
              <ChevronLeftIcon />
            )}
          </button>
        )}
      </aside>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer panel */}
      <div
        id="sidebar-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!open}
        className={`fixed left-0 top-0 z-40 flex h-full w-[min(280px,85vw)] flex-col border-r border-zinc-200 bg-white p-4 transition-transform duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-900 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-700">
          <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Menu
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:ring-2 focus-visible:ring-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-auto pt-4">
          <NavContent onNavigate={() => setOpen(false)} />
        </div>
      </div>
    </>
  );
}
