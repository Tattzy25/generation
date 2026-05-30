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
  // The MCP tool your backend exposes for this generator.
  toolName: "generate_image",
  // Static args that identify THIS generator. Rename / swap freely.
  arguments: {
    version: "your-trained-model-version-id",
    customer_id: "shopify-customer-id",
    source_id: "storefront-source-id",
    credits: 1,
  },
  // Optional: rename UI fields to match your tool's argument schema.
  // fieldNames: { prompt: "prompt", aspectRatio: "aspect_ratio", numOutputs: "num_outputs", image: "image" },
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
