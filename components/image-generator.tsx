"use client"

import type React from "react"

import { useCallback, useRef, useState } from "react"
import {
  Sparkles,
  ArrowUp,
  ImagePlus,
  X,
  Download,
  RotateCcw,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  AlertCircle,
  Loader2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"

type AspectRatio = "1:1" | "16:9" | "9:16"

type GeneratedImage = { url: string }

type GenerateResponse = { images: GeneratedImage[] }

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ASPECT_OPTIONS: { value: AspectRatio; label: string; icon: React.ElementType; box: string }[] = [
  { value: "1:1", label: "Square", icon: Square, box: "aspect-square" },
  { value: "16:9", label: "Landscape", icon: RectangleHorizontal, box: "aspect-video" },
  { value: "9:16", label: "Portrait", icon: RectangleVertical, box: "aspect-[9/16]" },
]

const ASPECT_CLASS: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export interface FieldNames {
  prompt?: string
  aspectRatio?: string
  numOutputs?: string
  image?: string
  version?: string
  customerId?: string
  sourceId?: string
  color?: string
}

export interface GeneratorConfig {
  toolName: string
  triggerWord?: string
  arguments?: Record<string, unknown>
  fieldNames?: FieldNames
}

export interface ImageGeneratorProps {
  config: GeneratorConfig
  endpoint?: string
  className?: string
}

const DEFAULT_FIELD_NAMES: Required<FieldNames> = {
  prompt: "prompt",
  aspectRatio: "aspect_ratio",
  numOutputs: "num_outputs",
  image: "image",
  version: "version",
  customerId: "customer_id",
  sourceId: "source_id",
  color: "color",
}

export function ImageGenerator({ config, endpoint = "/api/generate", className }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState("")
  const [aspect, setAspect] = useState<AspectRatio>("1:1")
  const [count, setCount] = useState(4)
  const [color, setColor] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<GeneratedImage[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((selected: File | null) => {
    setFileError(null)
    if (!selected) return
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setFileError("Unsupported file type. Use JPEG, PNG, or WebP.")
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFileError("File too large. Max 10MB.")
      return
    }
    setFile(selected)
    setFilePreview(URL.createObjectURL(selected))
  }, [])

  const clearFile = useCallback(() => {
    setFile(null)
    if (filePreview) URL.revokeObjectURL(filePreview)
    setFilePreview(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [filePreview])

  const canGenerate = prompt.trim().length > 0 && !loading

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return
    setLoading(true)
    setError(null)
    setImages([])

    try {
      const fields = { ...DEFAULT_FIELD_NAMES, ...config.fieldNames }

      const args: Record<string, unknown> = {
        ...(config.arguments ?? {}),
        [fields.prompt]: prompt.trim(),
        [fields.aspectRatio]: aspect,
        [fields.numOutputs]: count,
        timestamp: new Date().toISOString(),
      }

      if (color) args[fields.color] = color

      if (file) {
        args[fields.image] = await fileToBase64(file)
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName: config.toolName, arguments: args }),
      })

      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`)
      }

      const data = (await res.json()) as GenerateResponse
      const result = Array.isArray(data?.images) ? data.images.filter((i) => i?.url) : []

      if (result.length === 0) {
        throw new Error("No images were returned.")
      }

      setImages(result.slice(0, 4))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }, [canGenerate, prompt, aspect, count, color, file, endpoint, config])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handleGenerate()
    }
  }

  const skeletonCount = loading ? count : 0
  const outputCols = images.length > 1 || skeletonCount > 1 ? "grid-cols-2" : "grid-cols-1"

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-px overflow-hidden rounded-3xl border border-border bg-border lg:flex-row",
        "shadow-[0_2px_40px_-12px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      {/* Controls */}
      <div className="flex flex-col gap-7 bg-background p-6 sm:p-8 lg:w-1/2 lg:shrink-0">
        <header className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <h2 className="text-sm font-semibold tracking-tight">Generate</h2>
            <p className="text-xs text-muted-foreground">Describe your tattoo. Generate up to four.</p>
          </div>
        </header>

        {/* Prompt */}
        <div className="flex flex-col gap-2">
          <label htmlFor="prompt" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Prompt
          </label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="A studio product shot on a matte concrete surface, soft window light..."
            className="min-h-28 resize-none rounded-xl border-border bg-muted/40 text-sm leading-relaxed focus-visible:ring-foreground/20"
          />
          <p className="text-[11px] text-muted-foreground">
            Press <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">⌘</kbd>{" "}
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to generate
          </p>
        </div>

        {/* Color */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="color" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Color
          </label>
          <Input
            id="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="e.g. #ff0000"
            className="rounded-xl border-border bg-muted/40 text-sm"
          />
        </div>


        {/* Aspect ratio */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aspect Ratio</span>
          <div className="grid grid-cols-3 gap-2">
            {ASPECT_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const active = aspect === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAspect(opt.value)}
                  aria-pressed={active}
                  className={cn(
                    "group flex flex-col items-center gap-2 rounded-xl border px-3 py-3 transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{opt.value}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Outputs */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Outputs</span>
            <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-foreground px-1.5 text-xs font-semibold text-background tabular-nums">
              {count}
            </span>
          </div>
          <Slider
            value={[count]}
            onValueChange={(v) => setCount(v[0])}
            min={1}
            max={4}
            step={1}
            aria-label="Number of images"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>1</span>
            <span>Number of images</span>
            <span>4</span>
          </div>
        </div>

        {/* Reference image */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Reference Image <span className="normal-case opacity-70">(optional)</span>
          </span>

          {filePreview ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={filePreview || "/placeholder.svg"}
                alt="Reference preview"
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{file?.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={clearFile}
                aria-label="Remove reference image"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3.5 text-left transition-colors hover:border-foreground/40 hover:bg-muted/50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5 text-foreground">
                <ImagePlus className="h-4 w-4" />
              </span>
              <span className="leading-tight">
                <span className="block text-xs font-medium">Upload an image</span>
                <span className="block text-[11px] text-muted-foreground">JPEG, PNG, WebP · up to 10MB</span>
              </span>
            </button>
          )}

          {fileError && (
            <p className="flex items-center gap-1.5 text-[11px] text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {fileError}
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {/* Generate */}
        <Button
          type="button"
          size="lg"
          onClick={handleGenerate}
          disabled={loading}
          className="mt-1 h-12 rounded-xl text-sm font-semibold disabled:opacity-100"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate
              <ArrowUp className="ml-auto h-4 w-4 opacity-60" />
            </>
          )}
        </Button>
      </div>

      {/* Output canvas */}
      <div className="flex flex-1 flex-col bg-background p-6 sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Results</span>
          {images.length > 0 && !loading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleGenerate}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          )}
        </div>

        <div className="flex flex-1">
          {error ? (
            <div className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Generation failed</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleGenerate} className="mt-1">
                Try again
              </Button>
            </div>
          ) : loading ? (
            <div className={cn("grid w-full content-start gap-3", outputCols)}>
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border border-border bg-muted",
                    ASPECT_CLASS[aspect],
                  )}
                >
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          ) : images.length > 0 ? (
            <div className={cn("grid w-full content-start gap-3", outputCols)}>
              {images.map((img, i) => (
                <figure
                  key={i}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-border bg-muted",
                    ASPECT_CLASS[aspect],
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url || "/placeholder.svg"}
                    alt={`Generated result ${i + 1}`}
                    crossOrigin="anonymous"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <a
                    href={img.url}
                    download={`generated-${i + 1}.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-3 right-3 flex h-9 w-9 translate-y-1 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 backdrop-blur transition-all hover:bg-background group-hover:translate-y-0 group-hover:opacity-100"
                    aria-label={`Download image ${i + 1}`}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </figure>
              ))}
            </div>
          ) : (
            <div className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Your images will appear here</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Write a prompt and hit generate to create up to four images.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
