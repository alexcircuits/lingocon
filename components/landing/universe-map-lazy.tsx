"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

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

export function UniverseMapLazy({ languages }: { languages: UniverseLanguage[] }) {
    const ref = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setVisible(true)
                    observer.disconnect()
                }
            },
            { rootMargin: "300px" }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={ref} className="h-[600px] w-full">
            {visible ? (
                <LingoConUniverseMap languages={languages} />
            ) : (
                <div className="h-full w-full rounded-[36px] aurora-glass" />
            )}
        </div>
    )
}
