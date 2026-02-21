"use client";

import { useRef, useState, useCallback } from "react";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export default function SplitPane({ left, right }: SplitPaneProps) {
  const [leftWidth, setLeftWidth] = useState(40);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMouseDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftWidth(Math.min(75, Math.max(25, pct)));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 overflow-hidden"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div style={{ width: `${leftWidth}%` }} className="flex flex-col overflow-hidden">
        {left}
      </div>
      {/* Divider */}
      <div
        className="w-1 bg-zinc-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors"
        onMouseDown={onMouseDown}
      />
      <div className="flex flex-col overflow-hidden flex-1">
        {right}
      </div>
    </div>
  );
}
