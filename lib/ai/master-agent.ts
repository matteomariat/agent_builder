import { AgentConfig, UploadedFile } from "@/lib/store/useAppStore";

export function buildMasterSystemPrompt(
  masterAgent: AgentConfig,
  subagents: AgentConfig[],
  files: UploadedFile[]
): string {
  const fileList =
    files.length > 0
      ? `\n\nUploaded files available (use readFile tool to access them):\n${files
          .map((f) => `- ${f.name} (${f.type})`)
          .join("\n")}`
      : "";

  const subagentList =
    subagents.length > 0
      ? `\n\nAvailable subagents (use spawnSubagent tool to delegate tasks):\n${subagents
          .map((a) => `- id: "${a.id}", name: "${a.name}"`)
          .join("\n")}`
      : "\n\nNo subagents configured. You can complete tasks yourself.";

  return `${masterAgent.systemPrompt}

You are the master agent in a collaborative document editing session.

TOOLS AVAILABLE:
- writeToDocument: Write or append content to the shared working document
- readDocument: Read the current content of the working document
- readFile: Read the content of an uploaded file
- spawnSubagent: Delegate a task to a subagent${fileList}${subagentList}

When asked to work on the document, use writeToDocument to update it. Be collaborative and transparent about what you are doing.`;
}

export function buildSubagentSystemPrompt(
  agentConfig: AgentConfig,
  task: string,
  context?: string
): string {
  const contextSection = context ? `\n\nContext provided:\n${context}` : "";

  return `${agentConfig.systemPrompt}

You are a specialized subagent. Your current task is:
${task}${contextSection}

TOOLS AVAILABLE:
- writeToDocument: Write or append content to the shared working document
- readDocument: Read the current content of the working document
- readFile: Read the content of an uploaded file

Focus on completing your assigned task. Use writeToDocument to contribute your results to the shared document.`;
}
