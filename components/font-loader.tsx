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
            // Cleanup CSS variables to prevent style pollution on navigation
            document.documentElement.style.removeProperty('--language-font')
            document.documentElement.style.removeProperty('--language-font-scale')
        }
    }, [fontUrl, fontFamily, fontScale])

    return null
}
