import { ImageGenerator } from "@/components/image-generator"

/**
 * Per-generator config. This is the ONLY thing you change to reuse the
 * component across different generators / trained models. Swap the
 * `toolName`, the version/model id, credits, customer_id, etc.
 *
 * The actual MCP endpoint + auth key live server-side in the proxy
 * (app/api/generate/route.ts -> MCP_ENDPOINT / MCP_AUTHORIZATION env vars),
 * so nothing sensitive ships to the browser and there's no CORS.
 */
const GENERATOR_CONFIG = {
  toolName: "Artists N Models",
  fieldNames: { color: "COLOR" },
  arguments: {
    version: "",
    source_id: "ART-MOD-2000",
  },
}

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4 sm:p-8">
      <div className="w-full max-w-5xl">
        <ImageGenerator config={GENERATOR_CONFIG} />
      </div>
    </main>
  )
}
