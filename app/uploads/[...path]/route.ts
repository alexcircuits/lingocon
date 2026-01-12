import { NextRequest, NextResponse } from "next/server"
import { join } from "path"
import { readFile, stat } from "fs/promises"
import { existsSync } from "fs"

export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    try {
        // Construct the file path from the URL parameters
        // params.path is an array of path segments
        const filePath = join(process.cwd(), "uploads", ...params.path)

        // Check if file exists
        if (!existsSync(filePath)) {
            return new NextResponse("File not found", { status: 404 })
        }

        // Get file stats to verify it's a file
        const fileStat = await stat(filePath)
        if (!fileStat.isFile()) {
            return new NextResponse("Not a file", { status: 400 })
        }

        // Read the file
        const fileBuffer = await readFile(filePath)

        // Determine content type
        // We can use the extension or a library like 'mime'
        // Since we don't have 'mime' installed based on package.json inspection (I assume), 
        // I'll do a basic mapping or try to rely on what I know.
        // Actually, I should check if 'mime' or similar is available.
        // If not, I'll build a simple lookup based on the ALLOWED types in the upload route.

        const ext = filePath.split(".").pop()?.toLowerCase() || ""
        let contentType = "application/octet-stream"

        const mimeTypes: Record<string, string> = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "gif": "image/gif",
            "webp": "image/webp",
            "svg": "image/svg+xml",
            "ttf": "font/ttf",
            "otf": "font/otf",
            "woff": "font/woff",
            "woff2": "font/woff2",
            "pdf": "application/pdf",
            "txt": "text/plain",
            "epub": "application/epub+zip"
        }

        if (mimeTypes[ext]) {
            contentType = mimeTypes[ext]
        }

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        })
    } catch (error) {
        console.error("Error serving file:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
