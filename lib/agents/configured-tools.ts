import { tool, jsonSchema } from "ai";
import type { JSONSchema7 } from "ai";
import type { Tool } from "ai";
import { db } from "@/lib/db";
import { tools as toolsTable } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { log } from "@/lib/logger";

export const RESERVED_TOOL_NAMES = ["invoke_agent", "write_to_doc", "research", "create_agent"] as const;

export type ApiToolConfig = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  inputSchema: JSONSchema7;
};

function parseApiConfig(configJson: string): ApiToolConfig | null {
  try {
    const raw = JSON.parse(configJson) as unknown;
    if (
      raw &&
      typeof raw === "object" &&
      "url" in raw &&
      typeof (raw as { url: unknown }).url === "string" &&
      "method" in raw &&
      typeof (raw as { method: unknown }).method === "string" &&
      "inputSchema" in raw &&
      typeof (raw as { inputSchema: unknown }).inputSchema === "object"
    ) {
      const obj = raw as {
        url: string;
        method: string;
        headers?: Record<string, string>;
        inputSchema: JSONSchema7;
      };
      return {
        url: obj.url,
        method: obj.method,
        headers: obj.headers,
        inputSchema: obj.inputSchema as JSONSchema7,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/** Block localhost and private IPs to reduce SSRF risk. Allow same-origin (APP_BASE_URL / NEXT_PUBLIC_APP_URL) and localhost in development so proxy tools work. */
function isUrlAllowed(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();

    const appBase = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (appBase) {
      try {
        const appHost = new URL(appBase).hostname.toLowerCase();
        if (host === appHost) return true;
      } catch {
        // ignore invalid env URL
      }
    }
    if (process.env.NODE_ENV === "development" && (host === "localhost" || host === "127.0.0.1" || host === "::1")) {
      return true;
    }

    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (host.endsWith(".local")) return false;
    const parts = host.split(".").map((p) => parseInt(p, 10));
    if (parts.length === 4 && !parts.some((n) => Number.isNaN(n))) {
      if (parts[0] === 10) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function buildToolSetFromToolIds(
  userId: string,
  toolIds: string[]
): Promise<Record<string, Tool>> {
  if (toolIds.length === 0) return {};
  const rows = await db.query.tools.findMany({
    where: and(eq(toolsTable.userId, userId), inArray(toolsTable.id, toolIds)),
  });
  const out: Record<string, Tool> = {};
  for (const row of rows) {
    if (RESERVED_TOOL_NAMES.includes(row.name as (typeof RESERVED_TOOL_NAMES)[number])) continue;
    if (row.type !== "api") continue;
    const config = parseApiConfig(row.config);
    if (!config || !isUrlAllowed(config.url)) continue;
    const inputSchema = config.inputSchema as JSONSchema7;
    if (!inputSchema || typeof inputSchema !== "object") continue;
    const toolName = row.name;
    out[row.name] = tool({
      description: row.description,
      inputSchema: jsonSchema(inputSchema),
      execute: async (args: Record<string, unknown>) => {
        const method = (config.method || "GET").toUpperCase();
        let targetUrl = config.url;
        const headers: Record<string, string> = { ...config.headers };
        let body: string | undefined;
        if (method !== "GET" && args && typeof args === "object" && Object.keys(args).length > 0) {
          headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
          body = JSON.stringify(args);
        } else if (method === "GET" && args && typeof args === "object" && Object.keys(args).length > 0) {
          const search = new URLSearchParams();
          for (const [k, v] of Object.entries(args)) {
            if (v !== undefined && v !== null) search.set(k, String(v));
          }
          const sep = targetUrl.includes("?") ? "&" : "?";
          targetUrl = targetUrl + sep + search.toString();
        }
        let urlForLog = targetUrl;
        try {
          const u = new URL(targetUrl);
          urlForLog = `${u.host}${u.pathname}`;
        } catch {
          // keep full url if parse fails (e.g. relative)
        }
        const toolLog = log.child({ toolName });
        toolLog.info("tool.execute_start", { method, url: urlForLog });
        const startMs = Date.now();
        try {
          const res = await fetch(targetUrl, { method, headers, body });
          const text = await res.text();
          const durationMs = Date.now() - startMs;
          if (!res.ok) {
            toolLog.warn("tool.execute_finish", { durationMs, statusCode: res.status });
            return { error: `API returned ${res.status}`, body: text };
          }
          toolLog.info("tool.execute_finish", { durationMs, statusCode: res.status });
          try {
            return JSON.parse(text) as object;
          } catch {
            return { result: text };
          }
        } catch (err) {
          const durationMs = Date.now() - startMs;
          toolLog.warn("tool.execute_error", {
            durationMs,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      },
    });
  }
  return out;
}

export function parseToolIdsJson(toolIdsJson: string | null): string[] {
  if (!toolIdsJson || typeof toolIdsJson !== "string") return [];
  try {
    const arr = JSON.parse(toolIdsJson);
    return Array.isArray(arr) ? arr.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
