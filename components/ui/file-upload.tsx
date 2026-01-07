"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react"

interface FileUploadProps {
  type: "flag" | "cover" | "image" | "file" | "font"
  accept?: string
  maxSize?: number // in bytes
  value?: string
  onChange: (url: string | null, metadata?: { filename?: string; size?: number }) => void
  className?: string
  placeholder?: string
}

export function FileUpload({
  type,
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB default
  value,
  onChange,
  className,
  placeholder = "Drop file here or click to browse",
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    if (file.size > maxSize) {
      setError(`File too large. Max size: ${Math.round(maxSize / 1024 / 1024)}MB`)
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", type)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Upload failed")
      }

      const data = await response.json()
      onChange(data.url, { filename: data.filename, size: data.size })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setIsUploading(false)
    }
  }, [type, maxSize, onChange])

  const acceptConfig: Record<string, string[]> = accept
    ? { [accept]: [] }
    : type === "file"
      ? {
        "application/pdf": [".pdf"],
        "text/plain": [".txt"],
        "application/epub+zip": [".epub"],
      }
      : type === "font"
        ? {
          "font/ttf": [".ttf"],
          "font/otf": [".otf"],
          "font/woff": [".woff"],
          "font/woff2": [".woff2"],
          "font/sfnt": [".ttf", ".otf"],
          "application/font-sfnt": [".ttf", ".otf"],
          "application/vnd.ms-opentype": [".otf"],
          "application/x-font-truetype": [".ttf"],
          "application/font-woff": [".woff"],
        }
        : {
          "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
        }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptConfig,
    maxFiles: 1,
    disabled: isUploading,
  })

  const handleRemove = () => {
    onChange(null)
    setError(null)
  }

  const isImage = type === "flag" || type === "cover" || type === "image"

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div className="relative group">
          {isImage ? (
            <div className={cn(
              "relative aspect-video w-full max-w-xs overflow-hidden border border-border/40 bg-secondary/30",
              type !== "flag" && "rounded-xl"
            )}>
              {/* Use regular img for preview to support all sources including blob URLs */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Uploaded"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 border border-border/40 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-secondary/30">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{value.split("/").pop()}</p>
                <p className="text-xs text-muted-foreground">File uploaded</p>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                className="p-1.5 rounded-lg hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            "relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border/50 hover:border-primary/50 hover:bg-secondary/20",
            isUploading && "pointer-events-none opacity-50"
          )}
        >
          <input {...getInputProps()} />

          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </>
          ) : (
            <>
              {isImage ? (
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-3" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground mb-3" />
              )}
              <p className="text-sm text-center text-muted-foreground">
                {isDragActive ? "Drop the file here" : placeholder}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Max size: {Math.round(maxSize / 1024 / 1024)}MB
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}

