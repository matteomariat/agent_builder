/**
 * Type guards and helpers for AI SDK UIMessage parts.
 * Uses part shape from the stream; parts can be text, reasoning, tool-*, step-start, etc.
 */

export type ChatPart =
  | { type: "text"; text: string; state?: "streaming" | "done" }
  | { type: "reasoning"; text: string; state?: "streaming" | "done" }
  | { type: "step-start" }
  | { type: string; [k: string]: unknown };

export function isTextPart(part: ChatPart): part is { type: "text"; text: string; state?: "streaming" | "done" } {
  return part.type === "text";
}

export function isReasoningPart(
  part: ChatPart
): part is { type: "reasoning"; text: string; state?: "streaming" | "done" } {
  return part.type === "reasoning";
}

export function isStepStartPart(part: ChatPart): part is { type: "step-start" } {
  return part.type === "step-start";
}

export function isToolPart(part: ChatPart): boolean {
  return part.type === "dynamic-tool" || (typeof part.type === "string" && part.type.startsWith("tool-"));
}

export function getToolDisplayName(part: { type: string; toolName?: string }): string {
  const name = part.type === "dynamic-tool" ? part.toolName : part.type.replace(/^tool-/, "");
  const safeName = name ?? "tool";
  if (safeName === "invoke_agent") return "Agent call";
  return safeName
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ");
}
