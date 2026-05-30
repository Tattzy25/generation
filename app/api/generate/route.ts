import { type NextRequest, NextResponse } from "next/server"

/**
 * Server-side proxy for the MCP generation call.
 *
 * Why this exists:
 * - Avoids CORS entirely (the browser talks to this same-origin route, not the MCP server).
 * - Keeps your MCP endpoint URL + auth key OUT of the client bundle.
 * - Speaks JSON-RPC 2.0 (`tools/call`) to the MCP server and parses image URLs back out.
 *
 * The client sends: { toolName, arguments } (fully built per-generator).
 * This route wraps it in JSON-RPC and forwards it to MCP_ENDPOINT.
 */

// Long-running: MCP waits for Replicate + Cloudflare upload before returning.
export const maxDuration = 300

// Default MCP endpoint. Override per-deployment with the MCP_ENDPOINT env var.
const DEFAULT_MCP_ENDPOINT = "https://api.dify.ai/mcp/server/GToZKP/mcp"

const MAX_IMAGES = 4

type JsonRpcArgs = Record<string, unknown>

function getEndpoint(): string {
  return process.env.MCP_ENDPOINT?.trim() || DEFAULT_MCP_ENDPOINT
}

/**
 * Recursively walk any value and collect http(s) URLs from strings.
 * Embedded JSON strings are parsed and walked too, since MCP commonly
 * returns results as a JSON string inside a `text` content block.
 */
function collectUrls(value: unknown, found: string[], seen: Set<string>, depth = 0): void {
  if (depth > 8 || value == null) return

  if (typeof value === "string") {
    const str = value.trim()

    // Try to parse JSON payloads embedded as strings.
    if ((str.startsWith("{") && str.endsWith("}")) || (str.startsWith("[") && str.endsWith("]"))) {
      try {
        collectUrls(JSON.parse(str), found, seen, depth + 1)
        return
      } catch {
        // not JSON, fall through to URL scan
      }
    }

    const matches = str.match(/https?:\/\/[^\s"'<>)\]}]+/g)
    if (matches) {
      for (const m of matches) {
        const clean = m.replace(/[.,]+$/, "")
        if (!seen.has(clean)) {
          seen.add(clean)
          found.push(clean)
        }
      }
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, found, seen, depth + 1)
    return
  }

  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectUrls(v, found, seen, depth + 1)
    }
  }
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp)(\?|$)/i
const IMAGE_HOSTS = /(replicate\.delivery|imagedelivery\.net|r2\.cloudflarestorage|cloudflare|\.r2\.dev|blob\.|\/image|cdn)/i

/** Prefer URLs that are clearly images; fall back to all http URLs if none match. */
function rankImageUrls(urls: string[]): string[] {
  const strong = urls.filter((u) => IMAGE_EXT.test(u))
  if (strong.length) return strong

  const likely = urls.filter((u) => IMAGE_HOSTS.test(u))
  if (likely.length) return likely

  return urls
}

/** MCP "streamable HTTP" can answer with text/event-stream. Pull the last data: JSON frame. */
function parseSse(raw: string): unknown {
  const frames: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith("data:")) frames.push(trimmed.slice(5).trim())
  }
  const joined = frames.join("")
  if (!joined) return null
  try {
    return JSON.parse(joined)
  } catch {
    // Sometimes multiple JSON frames arrive; try the last standalone one.
    for (let i = frames.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(frames[i])
      } catch {
        // keep going
      }
    }
    return null
  }
}

const PROTOCOL_VERSION = "2025-06-18"

function baseHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Streamable HTTP servers answer with one of these two.
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  }


  return headers
}

/** Parse an upstream response body that may be raw JSON or an SSE-framed JSON-RPC reply. */
function parseBody(raw: string, contentType: string): unknown {
  if (contentType.includes("text/event-stream") || raw.startsWith("event:") || raw.includes("\ndata:")) {
    return parseSse(raw)
  }
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export async function POST(req: NextRequest) {
  let toolName: string
  let args: JsonRpcArgs

  try {
    const body = (await req.json()) as { toolName?: string; arguments?: JsonRpcArgs }
    if (!body?.toolName || typeof body.toolName !== "string") {
      return NextResponse.json({ error: "Missing 'toolName'." }, { status: 400 })
    }
    toolName = body.toolName
    args = body.arguments && typeof body.arguments === "object" ? body.arguments : {}
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const endpoint = getEndpoint()

  // ---- Step 1: initialize handshake (Streamable HTTP requires a session) ----
  let sessionId = ""
  try {
    const initRes = await fetch(endpoint, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "generation", version: "1.0.0" },
        },
      }),
    })

    sessionId = initRes.headers.get("mcp-session-id") || initRes.headers.get("Mcp-Session-Id") || ""

    if (!initRes.ok) {
      const detail = await initRes.text()
      return NextResponse.json(
        { error: `Generation server rejected initialize (${initRes.status}).`, detail: detail.slice(0, 500) },
        { status: 502 },
      )
    }
    // Drain body so the connection completes cleanly.
    await initRes.text()
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach generation server: ${err instanceof Error ? err.message : "network error"}` },
      { status: 502 },
    )
  }

  // Helper that always carries the session id once we have one.
  const sessionHeaders = (): Record<string, string> => {
    const h = baseHeaders()
    if (sessionId) h["Mcp-Session-Id"] = sessionId
    return h
  }

  // ---- Step 2: notify the server we're initialized (best-effort) ----
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: sessionHeaders(),
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    })
  } catch {
    // Non-fatal: some servers don't require this.
  }

  // ---- Step 3: the actual tools/call ----
  let upstream: Response
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: sessionHeaders(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach generation server: ${err instanceof Error ? err.message : "network error"}` },
      { status: 502 },
    )
  }

  const raw = await upstream.text()

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Generation server returned ${upstream.status}.`, detail: raw.slice(0, 500) },
      { status: 502 },
    )
  }

  const parsed = parseBody(raw, upstream.headers.get("content-type") || "")

  // Surface JSON-RPC errors clearly.
  if (parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>)) {
    const rpcError = (parsed as { error?: { message?: string } }).error
    return NextResponse.json(
      { error: rpcError?.message || "The generation tool reported an error." },
      { status: 502 },
    )
  }

  const found: string[] = []
  collectUrls(parsed, found, new Set<string>())
  const images = rankImageUrls(found)
    .slice(0, MAX_IMAGES)
    .map((url) => ({ url }))

  if (images.length === 0) {
    return NextResponse.json(
      { error: "No image URLs were found in the generation response.", detail: raw.slice(0, 500) },
      { status: 502 },
    )
  }

  return NextResponse.json({ images })
}
