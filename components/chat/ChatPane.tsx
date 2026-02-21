"use client";

import { useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAppStore } from "@/lib/store/useAppStore";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import SubagentFeed from "./SubagentFeed";

export default function ChatPane() {
  const {
    agents,
    setDocumentContent,
    setDocumentLock,
    addSubagentTask,
    updateSubagentTask,
  } = useAppStore((s) => ({
    agents: s.agents,
    setDocumentContent: s.setDocumentContent,
    setDocumentLock: s.setDocumentLock,
    addSubagentTask: s.addSubagentTask,
    updateSubagentTask: s.updateSubagentTask,
  }));

  const masterAgent = agents.find((a) => a.isMaster);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => {
          const state = useAppStore.getState();
          const master = state.agents.find((a) => a.isMaster);
          const subs = state.agents.filter((a) => !a.isMaster);
          return {
            masterAgent: master,
            agents: subs,
            files: state.files,
            documentContent: state.documentContent,
          };
        },
      }),
    []
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onData: (dataPart: any) => {
      const type: string = dataPart.type;
      const data = (dataPart.data ?? {}) as Record<string, unknown>;

      if (type === "document_write") {
        const { content, mode } = data as { content: string; mode: string };
        setDocumentLock("agent", "Agent");

        setDocumentContent(
          mode === "replace"
            ? String(content)
            : useAppStore.getState().documentContent + String(content)
        );

        setTimeout(() => setDocumentLock("idle"), 600);
      }

      if (type === "subagent_start") {
        const { taskId, agentId, agentName, task } = data as {
          taskId: string;
          agentId: string;
          agentName: string;
          task: string;
        };
        addSubagentTask({
          id: taskId,
          agentId,
          agentName,
          task,
          status: "running",
        });
      }

      if (type === "subagent_done") {
        const { taskId, result } = data as { taskId: string; result: string };
        updateSubagentTask(taskId, { status: "done", result });
      }

      if (type === "subagent_error") {
        const { taskId } = data as { taskId: string };
        updateSubagentTask(taskId, { status: "error" });
      }
    },
  });

  const handleSend = (text: string) => {
    sendMessage({ text });
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-zinc-100">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-100 flex-shrink-0">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
          Master Agent
        </span>
        {masterAgent ? (
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
            {masterAgent.name}
          </span>
        ) : (
          <span className="text-xs text-zinc-400">
            — configure an agent above
          </span>
        )}
      </div>

      {/* Messages */}
      <MessageList messages={messages} status={status} />

      {/* Subagent activity feed */}
      <SubagentFeed />

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        disabled={status === "submitted" || status === "streaming"}
        hasMaster={!!masterAgent}
      />
    </div>
  );
}
