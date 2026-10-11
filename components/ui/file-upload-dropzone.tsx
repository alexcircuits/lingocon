"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { DEFAULT_MAX_UPLOAD_SIZE, DEFAULT_UPLOAD_PLACEHOLDER, FileUploadView } from "@/components/ui/file-upload-view"
import type { FileUploadProps } from "@/components/ui/file-upload"

/** The interactive upload field (react-dropzone). Loaded through `FileUpload`. */
export function FileUploadDropzone({
  type,
  accept,
  maxSize = DEFAULT_MAX_UPLOAD_SIZE,
  value,
  onChange,
  className,
  placeholder = DEFAULT_UPLOAD_PLACEHOLDER,
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
          "application/octet-stream": [".ttf", ".otf", ".woff", ".woff2"],
          "font/*": [".ttf", ".otf", ".woff", ".woff2"],
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

  return (
    <FileUploadView
      type={type}
      value={value}
      maxSize={maxSize}
      placeholder={placeholder}
      className={className}
      error={error}
      isUploading={isUploading}
      isDragActive={isDragActive}
      onRemove={handleRemove}
      dropzone={{ rootProps: getRootProps(), inputProps: getInputProps() }}
    />
  )
}
