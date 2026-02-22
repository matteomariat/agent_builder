"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";

const STORAGE_KEY = "sidebar-collapsed";

export function MainLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {
      // ignore
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [mounted, collapsed]);

  const mainPaddingLeft = collapsed ? "md:pl-16" : "md:pl-[240px]";

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      <main
        className={`min-h-screen flex-1 min-w-0 pt-14 ${mainPaddingLeft} md:pt-0 transition-[padding] duration-200 ease-out`}
      >
        {children}
      </main>
    </div>
  );
}
