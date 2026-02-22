import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { log } from "@/lib/logger";

export type AgentSummary = { id: string; name: string; description: string };

/**
 * Lightweight router: suggests which sub-agent (if any) best matches the user's request.
 * Returns { agentId, agentName } or null. The master can use this as a hint and still override.
 */
export async function suggestAgentForRequest(
  userMessage: string,
  agents: AgentSummary[]
): Promise<{ agentId: string; agentName: string } | null> {
  if (agents.length === 0) return null;
  const routerLog = log.child({ fn: "suggestAgentForRequest" });
  const listText = agents.map((a) => `${a.name} (id: ${a.id}): ${a.description || "No description"}`).join("\n");
  const prompt = `Given this user message, choose the single best-matching agent by replying with only that agent's id, or reply "none" if no agent is a good fit.

Agents:
${listText}

User message:
${userMessage.slice(0, 1500)}

Reply with exactly one line: either the agent id (copy it exactly from the list) or the word "none".`;

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });
    const raw = text?.trim().toLowerCase() ?? "";
    if (!raw || raw === "none") return null;
    const firstLine = raw.split(/\n/)[0]?.trim() ?? raw;
    let found = agents.find((a) => a.id === firstLine || a.id.toLowerCase() === firstLine);
    if (!found) {
      found = agents.find((a) => firstLine.includes(a.id) || raw.includes(a.id.toLowerCase()));
    }
    if (!found) {
      routerLog.info("suggest.no_match", { raw: text?.trim() });
      return null;
    }
    routerLog.info("suggest.matched", { agentId: found.id, agentName: found.name });
    return { agentId: found.id, agentName: found.name };
  } catch (err) {
    routerLog.warn("suggest.error", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
