"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Loader2, GitBranch, Globe, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/lib/hooks/use-is-mobile"

const LingoConUniverseMap = dynamic(
    () => import("@/components/landing/universe-map").then((m) => m.LingoConUniverseMap),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full w-full items-center justify-center rounded-[36px] aurora-glass text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        ),
    }
)

// Match the LanguageData shape consumed by the map.
type UniverseLanguage = React.ComponentProps<typeof LingoConUniverseMap>["languages"][number]

/**
 * Lightweight, dependency-free teaser shown to mobile/touch devices instead of the
 * canvas force-graph. The graph engine is memory-heavy and routinely crashes mobile
 * browsers, so phones get a polished static card that links to the full experience.
 */
function UniverseMapMobileFallback({ count }: { count: number }) {
    return (
        <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[28px] aurora-glass px-6 py-10 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_30%,hsl(var(--primary)/0.12),transparent_70%)]" />

            {/* Decorative constellation of nodes */}
            <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
                <span className="absolute left-[18%] top-[22%] h-2.5 w-2.5 rounded-full bg-primary/60 blur-[0.5px]" />
                <span className="absolute left-[72%] top-[18%] h-2 w-2 rounded-full bg-[hsl(var(--aurora-blue))]/60" />
                <span className="absolute left-[30%] top-[68%] h-3 w-3 rounded-full bg-primary/40" />
                <span className="absolute left-[80%] top-[64%] h-2 w-2 rounded-full bg-[hsl(var(--aurora-blue))]/50" />
                <span className="absolute left-[52%] top-[44%] h-3.5 w-3.5 rounded-full bg-primary/50" />
            </div>

            <div className="relative z-10 flex flex-col items-center">
                <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <GitBranch className="h-7 w-7" />
                </span>
                <h3 className="text-2xl font-extrabold tracking-tight">
                    {count > 0 ? `${count} languages` : "A living universe"}
                    <br />
                    <span className="aurora-gradient-text">connected by family trees</span>
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    The full interactive map runs best on a larger screen. Browse every public
                    language and its family connections below.
                </p>

                <div className="mt-7 flex w-full max-w-xs flex-col gap-3">
                    <Link href="/families" className="block w-full">
                        <Button className="h-12 w-full gap-2 rounded-full text-base font-semibold">
                            <GitBranch className="h-5 w-5" />
                            Explore Families
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                    <Link href="/browse" className="block w-full">
                        <Button
                            variant="outline"
                            className="h-12 w-full gap-2 rounded-full border-2 bg-card/50 text-base font-semibold backdrop-blur-md"
                        >
                            <Globe className="h-5 w-5" />
                            Browse Languages
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}

export function UniverseMapLazy({ languages }: { languages: UniverseLanguage[] }) {
    const [enabled, setEnabled] = useState(false)
    const isMobile = useIsMobile()

    // While detecting (undefined) or on mobile, render the lightweight fallback.
    // This guarantees the crash-prone force-graph bundle never loads on phones.
    if (isMobile !== false) {
        return (
            <div className="h-[440px] w-full sm:h-[520px]">
                <UniverseMapMobileFallback count={languages.length} />
            </div>
        )
    }

    return (
        <div className="h-[600px] w-full">
            {enabled ? (
                <LingoConUniverseMap languages={languages} />
            ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-[36px] aurora-glass px-6 text-center">
                    <p>{languages.length} languages connected by family trees</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                        Load the interactive map to explore. It uses additional memory and graphics resources.
                    </p>
                    <Button type="button" onClick={() => setEnabled(true)}>
                        Load interactive map
                    </Button>
                </div>
            )}
        </div>
    )
}
