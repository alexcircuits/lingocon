import type { DropzoneInputProps, DropzoneRootProps } from "react-dropzone"
import { cn } from "@/lib/utils"
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react"

export type FileUploadType = "flag" | "cover" | "image" | "file" | "font"

export const DEFAULT_MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10MB
export const DEFAULT_UPLOAD_PLACEHOLDER = "Drop file here or click to browse"

export interface FileUploadViewProps {
  type: FileUploadType
  value?: string
  maxSize: number
  placeholder: string
  className?: string
  error: string | null
  isUploading: boolean
  isDragActive: boolean
  onRemove: () => void
  /** The dropzone's wiring; absent while its code is still loading (the area is not clickable yet). */
  dropzone?: {
    rootProps: DropzoneRootProps
    inputProps: DropzoneInputProps
  }
}

/** The upload field's markup, shared by the dropzone and the placeholder shown while it loads. */
export function FileUploadView({
  type,
  value,
  maxSize,
  placeholder,
  className,
  error,
  isUploading,
  isDragActive,
  onRemove,
  dropzone,
}: FileUploadViewProps) {
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
                onClick={onRemove}
            aria-label="Remove file"
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
                onClick={onRemove}
            aria-label="Remove file"
                className="p-1.5 rounded-lg hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          {...dropzone?.rootProps}
          className={cn(
            "relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border/50 hover:border-primary/50 hover:bg-secondary/20",
            isUploading && "pointer-events-none opacity-50"
          )}
        >
          {dropzone && <input {...dropzone.inputProps} />}

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
