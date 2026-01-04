"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { useEffect } from "react"
import Link from "next/link"

export function SearchBar() {
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        router.push("/search")
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [router])

  return (
    <Link href="/search" className="w-full">
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 xl:h-9 xl:w-56 xl:justify-start xl:gap-2 xl:px-3 bg-muted/40 hover:bg-muted/70 border-border/50 shadow-sm transition-all duration-200"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="hidden xl:inline text-sm text-muted-foreground/80">Search...</span>
        <kbd className="pointer-events-none hidden xl:inline-flex ml-auto h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-background/60 px-1.5 font-mono text-[10px] text-muted-foreground/70">
          ⌘K
        </kbd>
      </Button>
    </Link>
  )
}
