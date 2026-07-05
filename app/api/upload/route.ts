import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import sharp from "sharp"
import { validateUpload, RASTER_IMAGE_MIME, type UploadType } from "@/lib/uploads"

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

    const validation = validateUpload({
      name: file.name,
      mimeType: file.type,
      size: file.size,
      type: type as UploadType,
    })
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const uploadType = validation.dir
    let ext = validation.ext

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), "public", "uploads", uploadType)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    let filename = `${timestamp}-${randomStr}.${ext}`
    let filepath = join(uploadDir, filename)
    let finalUrl = `/uploads/${uploadType}/${filename}`
    let finalSize = file.size
    let finalType = file.type

    // Process file
    const bytes = await file.arrayBuffer()
    let buffer = Buffer.from(bytes)

    // Convert non-svg images to webp
    if (RASTER_IMAGE_MIME.includes(file.type)) {
      buffer = Buffer.from(await sharp(buffer).webp({ quality: 80 }).toBuffer())
      ext = "webp"
      filename = `${timestamp}-${randomStr}.${ext}`
      filepath = join(uploadDir, filename)
      finalUrl = `/uploads/${uploadType}/${filename}`
      finalSize = buffer.length
      finalType = "image/webp"
    }

    // Write file
    await writeFile(filepath, buffer)

    return NextResponse.json({
      url: finalUrl,
      filename: file.name,
      size: finalSize,
      type: finalType
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

