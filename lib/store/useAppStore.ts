import { create } from "zustand";

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  content: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  modelId: string;
  isMaster: boolean;
}

export interface SubagentTask {
  id: string;
  agentId: string;
  agentName: string;
  task: string;
  status: "running" | "done" | "error";
  result?: string;
}

export type DocumentLock = "idle" | "user" | "agent";

interface AppState {
  // Files
  files: UploadedFile[];
  // Agents
  agents: AgentConfig[];
  // Subagent tasks
  subagentTasks: SubagentTask[];
  // Document
  documentContent: string;
  documentLock: DocumentLock;
  documentLockHolder: string | null;

  // File actions
  addFiles: (files: UploadedFile[]) => void;
  removeFile: (id: string) => void;

  // Agent actions
  addAgent: (agent: AgentConfig) => void;
  updateAgent: (id: string, update: Partial<AgentConfig>) => void;
  removeAgent: (id: string) => void;

  // Document actions
  setDocumentContent: (content: string) => void;
  setDocumentLock: (lock: DocumentLock, holder?: string | null) => void;

  // Subagent task actions
  addSubagentTask: (task: SubagentTask) => void;
  updateSubagentTask: (id: string, update: Partial<SubagentTask>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  files: [],
  agents: [],
  subagentTasks: [],
  documentContent: "",
  documentLock: "idle",
  documentLockHolder: null,

  addFiles: (files) =>
    set((state) => ({ files: [...state.files, ...files] })),

  removeFile: (id) =>
    set((state) => ({ files: state.files.filter((f) => f.id !== id) })),

  addAgent: (agent) =>
    set((state) => ({ agents: [...state.agents, agent] })),

  updateAgent: (id, update) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...update } : a)),
    })),

  removeAgent: (id) =>
    set((state) => ({ agents: state.agents.filter((a) => a.id !== id) })),

  setDocumentContent: (content) => set({ documentContent: content }),

  setDocumentLock: (lock, holder = null) =>
    set({ documentLock: lock, documentLockHolder: holder }),

  addSubagentTask: (task) =>
    set((state) => ({ subagentTasks: [task, ...state.subagentTasks] })),

  updateSubagentTask: (id, update) =>
    set((state) => ({
      subagentTasks: state.subagentTasks.map((t) =>
        t.id === id ? { ...t, ...update } : t
      ),
    })),
}));
