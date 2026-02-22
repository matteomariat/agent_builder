import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { log } from "@/lib/logger";
import { RESERVED_TOOL_NAMES } from "@/lib/agents/configured-tools";

const suggestLog = log.child({ fn: "suggestTool" });

const inputSchemaPropertySchema = z.object({
  type: z.string().describe("JSON Schema type, e.g. string, number, boolean"),
  description: z.string().optional().describe("Human-readable description of the parameter"),
});

export const suggestToolSchema = z.object({
  name: z
    .string()
    .describe(
      "Unique snake_case identifier for the tool. Must not be one of: " +
        RESERVED_TOOL_NAMES.join(", ")
    ),
  description: z
    .string()
    .describe(
      "Clear description for the LLM: when to use this tool and what it returns"
    ),
  url: z
    .string()
    .describe(
      "Full API URL. Use placeholders like {API_KEY} if the user does not provide a key"
    ),
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
    .describe("HTTP method for the API call"),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Optional HTTP headers, e.g. { \"Authorization\": \"Bearer {API_KEY}\" }"
    ),
  inputSchema: z
    .object({
      type: z.literal("object"),
      properties: z
        .record(z.string(), inputSchemaPropertySchema)
        .describe("Map of parameter name to JSON Schema property (type, description)"),
      required: z
        .array(z.string())
        .optional()
        .describe("List of required parameter names"),
    })
    .describe("JSON Schema for the tool parameters the model will send"),
});

export type SuggestToolResult = z.infer<typeof suggestToolSchema>;

const SYSTEM_PROMPT = `You are helping to configure an API-call tool for an AI agent. Given a short user description, produce a complete tool configuration.

Rules:
- name: snake_case only, no spaces. Must NOT be any of: ${RESERVED_TOOL_NAMES.join(", ")}.
- description: One or two sentences so the AI knows when to use this tool and what it returns.
- url: Full endpoint URL. If the API needs a key and the user did not provide one, use a placeholder like {API_KEY} or {YOUR_API_KEY} in the URL or in headers.
- method: Choose GET for read-only/search, POST for creating or when sending a body, etc.
- headers: Include only if needed (e.g. Authorization, X-API-Key). Use placeholders for secrets.
- inputSchema: JSON Schema "object" with "properties" (each with "type" and "description") and "required" (array of required keys). Use clear, short parameter descriptions.`;

/**
 * Suggests tool configuration from natural-language user input.
 * Returns fields ready to fill the create-tool form (name, description, url, method, headers?, inputSchema).
 */
export async function suggestTool(
  userInput: string
): Promise<SuggestToolResult | null> {
  const trimmed = userInput?.trim();
  if (!trimmed) return null;

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: suggestToolSchema,
      schemaName: "SuggestedApiTool",
      schemaDescription: "API tool configuration for an AI agent",
      prompt: `User description of the tool they want:\n\n${trimmed.slice(0, 2000)}`,
      system: SYSTEM_PROMPT,
    });

    if (!object?.name || !object?.description || !object?.url) {
      suggestLog.warn("suggest.incomplete", { hasName: !!object?.name });
      return null;
    }

    if (RESERVED_TOOL_NAMES.includes(object.name as (typeof RESERVED_TOOL_NAMES)[number])) {
      suggestLog.warn("suggest.reserved_name", { name: object.name });
      return null;
    }

    suggestLog.info("suggest.ok", { name: object.name });
    return object as SuggestToolResult;
  } catch (err) {
    suggestLog.warn("suggest.error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
