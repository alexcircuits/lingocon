import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
const ALLOWED_FONT_TYPES = ["font/ttf", "font/otf", "font/woff", "font/woff2", "application/x-font-ttf", "application/x-font-opentype", "application/font-woff", "application/font-woff2"]
const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf", "text/plain", "application/epub+zip", ...ALLOWED_FONT_TYPES]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    // Allow in dev mode or with valid session
    if (!session?.user?.id && process.env.DEV_MODE !== "true") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const type = formData.get("type") as string | null // "flag", "cover", "image", "file"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!type) {
      return NextResponse.json({ error: "Upload type not specified" }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 })
    }

    // Validate file type based on upload type
    let allowedTypes = ALLOWED_IMAGE_TYPES
    if (type === "file") allowedTypes = ALLOWED_FILE_TYPES
    if (type === "font") allowedTypes = ALLOWED_FONT_TYPES

    // Use "cover" directory for "image" type as well
    const uploadType = type === "image" ? "cover" : type
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: `Invalid file type. Allowed: ${allowedTypes.join(", ")}`
      }, { status: 400 })
    }

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), "public", "uploads", uploadType)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const ext = file.name.split(".").pop() || "bin"
    const filename = `${timestamp}-${randomStr}.${ext}`
    const filepath = join(uploadDir, filename)

    // Write file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Return public URL (ensure it starts with /)
    const url = `/uploads/${uploadType}/${filename}`

    return NextResponse.json({
      url,
      filename: file.name,
      size: file.size,
      type: file.type
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

