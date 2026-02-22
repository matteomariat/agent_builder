import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { isTargetUrlAllowed } from "@/lib/url-allowed";

const FETCH_TIMEOUT_MS = 15000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Missing url in body" }, { status: 400 });
  }
  if (!isTargetUrlAllowed(url)) {
    return NextResponse.json({ error: "URL not allowed (localhost or private IP)" }, { status: 400 });
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentBuilder/1.0)" },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: ${res.status} ${res.statusText}` }, { status: 502 });
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Response too large" }, { status: 413 });
    }
    html = new TextDecoder().decode(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const main = document.body;

    const turndown = new TurndownService({ headingStyle: "atx" });
    turndown.remove(["script", "style", "nav", "footer", "aside", "form", "iframe"]);
    const markdown = turndown.turndown(main);

    const simplified = markdown
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+|\s+$/gm, "")
      .trim();

    return NextResponse.json({ markdown: simplified });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "HTML conversion failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
