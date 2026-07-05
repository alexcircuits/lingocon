// Shared upload validation used by app/api/upload/route.ts (and, from Wave 4,
// the audio recorder). Pure — no fs, no next imports — so it unit-tests cleanly.

export const RASTER_IMAGE_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const IMAGE_MIME = [...RASTER_IMAGE_MIME, "image/svg+xml"]
const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "svg"]
const AUDIO_MIME = ["audio/webm", "audio/mp3", "audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4"]
const AUDIO_EXT = ["webm", "mp3", "ogg", "wav", "m4a", "mp4"]
const FONT_MIME = [
  "font/ttf", "font/otf", "font/woff", "font/woff2",
  "application/x-font-ttf", "application/x-font-opentype", "application/font-woff", "application/font-woff2",
  "font/sfnt", "application/font-sfnt", "application/vnd.ms-opentype", "application/x-font-truetype",
]
const FONT_EXT = ["ttf", "otf", "woff", "woff2"]
const FILE_MIME = [...IMAGE_MIME, "application/pdf", "text/plain", "application/epub+zip", ...FONT_MIME, ...AUDIO_MIME]
const FILE_EXT = [...IMAGE_EXT, "pdf", "txt", "epub", ...FONT_EXT, ...AUDIO_EXT]

const MB = 1024 * 1024

export type UploadType = "flag" | "cover" | "image" | "file" | "font" | "audio" | "word-audio"

interface UploadRule {
  mime: string[]
  ext: string[]
  maxBytes: number
  dir?: string
  extFallback?: boolean
}

export const UPLOAD_RULES: Record<UploadType, UploadRule> = {
  flag: { mime: IMAGE_MIME, ext: IMAGE_EXT, maxBytes: 5 * MB },
  cover: { mime: IMAGE_MIME, ext: IMAGE_EXT, maxBytes: 15 * MB },
  image: { mime: IMAGE_MIME, ext: IMAGE_EXT, maxBytes: 15 * MB, dir: "cover" },
  file: { mime: FILE_MIME, ext: FILE_EXT, maxBytes: 15 * MB },
  font: { mime: FONT_MIME, ext: FONT_EXT, maxBytes: 15 * MB, extFallback: true },
  audio: { mime: AUDIO_MIME, ext: AUDIO_EXT, maxBytes: 5 * MB },
  "word-audio": { mime: AUDIO_MIME, ext: AUDIO_EXT, maxBytes: 1 * MB },
}

export interface UploadInput {
  name: string
  mimeType: string
  size: number
  type: UploadType
}

export type UploadValidation =
  | { ok: true; ext: string; dir: string }
  | { ok: false; error: string }

export function validateUpload(input: UploadInput): UploadValidation {
  const rule = UPLOAD_RULES[input.type]
  if (!rule) return { ok: false, error: "Invalid upload type" }

  if (input.size > rule.maxBytes) {
    return { ok: false, error: `File too large (max ${Math.round(rule.maxBytes / MB)}MB)` }
  }

  const ext = input.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? ""
  const mime = input.mimeType.split(";")[0].trim().toLowerCase()

  const mimeOk = rule.mime.includes(mime)
  const extOk = rule.ext.includes(ext)

  if (!extOk) {
    return { ok: false, error: `Invalid file extension ".${ext}" for ${input.type} upload` }
  }
  if (!mimeOk && !rule.extFallback) {
    return { ok: false, error: `Invalid file type "${mime}" for ${input.type} upload` }
  }

  return { ok: true, ext, dir: rule.dir ?? input.type }
}
