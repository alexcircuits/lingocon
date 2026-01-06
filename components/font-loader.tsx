"use client"

import { useEffect } from "react"

interface FontLoaderProps {
    fontUrl?: string | null
    fontFamily?: string | null
    fontScale?: number
}

export function FontLoader({ fontUrl, fontFamily, fontScale = 1.0 }: FontLoaderProps) {
    useEffect(() => {
        if (!fontUrl) return

        const fontName = fontFamily || "CustomLanguageFont"

        // Create new font face
        const font = new FontFace(fontName, `url(${fontUrl})`)

        font.load().then((loadedFont) => {
            // Add font to document
            document.fonts.add(loadedFont)

            // Set CSS variable for usage in components
            document.documentElement.style.setProperty('--language-font', fontName)
            document.documentElement.style.setProperty('--language-font-scale', String(fontScale))
            console.log(`Loaded custom font: ${fontName} with scale ${fontScale}`)
        }).catch((err) => {
            console.error("Failed to load custom font:", err)
        })

        return () => {
            // Cleanup CSS variable - though persistence might be desired during navigation
            // We keep it to avoid style pollution when switching languages if spa navigation
            // But clearing it on unmount might flash fonts. 
            // For now, let's leave it as it will be overwritten by next load or page refresh
        }
    }, [fontUrl, fontFamily, fontScale])

    return null
}
