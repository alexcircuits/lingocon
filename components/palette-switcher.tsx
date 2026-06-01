"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

type Palette = "aurora" | "classic"

const OPTIONS: {
  id: Palette
  name: string
  desc: string
  swatch: [string, string, string]
}[] = [
  {
    id: "aurora",
    name: "Aurora",
    desc: "Vibrant violet, geometric type, playful rounded corners. (Default)",
    swatch: ["#7c5cff", "#3b82f6", "#ff4dcd"],
  },
  {
    id: "classic",
    name: "Classic",
    desc: "Warm teal & cream with editorial serif headings — the original look.",
    swatch: ["#1f7a6e", "#e8855a", "#efe9dc"],
  },
]

function applyPalette(p: Palette) {
  try {
    localStorage.setItem("palette", p)
  } catch {
    /* ignore */
  }
  if (p === "classic") {
    document.documentElement.setAttribute("data-palette", "classic")
  } else {
    document.documentElement.removeAttribute("data-palette")
  }
}

export function PaletteSwitcher() {
  const [palette, setPalette] = useState<Palette>("aurora")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = (localStorage.getItem("palette") as Palette | null) ?? "aurora"
      setPalette(stored === "classic" ? "classic" : "aurora")
    } catch {
      setPalette("aurora")
    }
  }, [])

  const select = (p: Palette) => {
    setPalette(p)
    applyPalette(p)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((opt) => {
        const active = mounted && palette === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => select(opt.id)}
            aria-pressed={active}
            className={cn(
              "group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all",
              active
                ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                : "border-border/60 hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {opt.swatch.map((c, i) => (
                  <span
                    key={i}
                    className="h-6 w-6 rounded-full border border-black/5 shadow-sm"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              {active && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </div>
            <div>
              <div className="font-semibold">{opt.name}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{opt.desc}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
