"use client";

import { useState } from "react";
import FileUploadZone from "@/components/files/FileUploadZone";
import FileList from "@/components/files/FileList";
import AgentDialog from "@/components/agents/AgentDialog";
import AgentList from "@/components/agents/AgentList";

export default function Header() {
  const [showUpload, setShowUpload] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);

  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-white border-b border-zinc-200 flex-shrink-0">
      <span className="font-semibold text-zinc-800 text-sm mr-2">AgentBuilder</span>

      <button
        onClick={() => { setShowUpload(!showUpload); setShowAgents(false); }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 hover:bg-zinc-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Files
      </button>

      <button
        onClick={() => { setShowAgents(!showAgents); setShowUpload(false); }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 hover:bg-zinc-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
        </svg>
        Agents
      </button>

      {/* Dropdowns */}
      {showUpload && (
        <div className="absolute top-12 left-0 right-0 z-50 bg-white border-b border-zinc-200 shadow-sm p-4">
          <FileList />
          <FileUploadZone onClose={() => setShowUpload(false)} />
        </div>
      )}

      {showAgents && (
        <div className="absolute top-12 left-0 right-0 z-50 bg-white border-b border-zinc-200 shadow-sm p-4">
          <AgentList onAdd={() => setShowAgentForm(true)} />
        </div>
      )}

      {showAgentForm && (
        <AgentDialog onClose={() => setShowAgentForm(false)} />
      )}
    </header>
  );
}
