import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/db/users";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export async function runUserAgent(
  agentId: string,
  message: string
): Promise<string> {
  const userId = getDefaultUserId();
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.userId, userId)),
  });
  if (!agent) {
    return `Error: Agent ${agentId} not found.`;
  }
  const modelId = agent.model ?? DEFAULT_GEMINI_MODEL;
  const model = google(modelId);
  const { text } = await generateText({
    model,
    system: agent.systemPrompt,
    prompt: message,
  });
  return text;
}
