"use client"

import { useEffect, useRef } from "react"
import createGlobe, { type COBEOptions } from "cobe"
import { useMotionValue, useSpring } from "motion/react"
import { cn } from "@/lib/utils"

const MOVEMENT_DAMPING = 1400

const GLOBE_CONFIG: COBEOptions = {
    width: 800,
    height: 800,
    onRender: () => {},
    devicePixelRatio: 2,
    phi: 0,
    theta: 0.3,
    dark: 0,
    diffuse: 0.4,
    mapSamples: 16000,
    mapBrightness: 1.2,
    baseColor: [1, 1, 1],
    markerColor: [124 / 255, 92 / 255, 255 / 255],
    glowColor: [1, 1, 1],
    markers: [
        { location: [14.5995, 120.9842], size: 0.03 },
        { location: [19.076, 72.8777], size: 0.1 },
        { location: [23.8103, 90.4125], size: 0.05 },
        { location: [30.0444, 31.2357], size: 0.07 },
        { location: [39.9042, 116.4074], size: 0.08 },
        { location: [-23.5505, -46.6333], size: 0.1 },
        { location: [19.4326, -99.1332], size: 0.1 },
        { location: [40.7128, -74.006], size: 0.1 },
        { location: [34.6937, 135.5022], size: 0.05 },
        { location: [41.0082, 28.9784], size: 0.06 },
        { location: [51.5074, -0.1278], size: 0.07 },
        { location: [48.8566, 2.3522], size: 0.06 },
        { location: [55.7558, 37.6173], size: 0.06 },
        { location: [-33.8688, 151.2093], size: 0.06 },
    ],
}

export function Globe({
    className,
    config = GLOBE_CONFIG,
}: {
    className?: string
    config?: COBEOptions
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const phiRef = useRef(0)
    const widthRef = useRef(0)
    const pointerInteracting = useRef<number | null>(null)
    const pointerInteractionMovement = useRef(0)

    const r = useMotionValue(0)
    const rs = useSpring(r, { mass: 1, damping: 30, stiffness: 100 })

    const updatePointerInteraction = (value: number | null) => {
        pointerInteracting.current = value
        if (canvasRef.current) {
            canvasRef.current.style.cursor = value !== null ? "grabbing" : "grab"
        }
    }

    const updateMovement = (clientX: number) => {
        if (pointerInteracting.current !== null) {
            const delta = clientX - pointerInteracting.current
            pointerInteractionMovement.current = delta
            r.set(r.get() + delta / MOVEMENT_DAMPING)
        }
    }

    useEffect(() => {
        const onResize = () => {
            if (canvasRef.current) {
                widthRef.current = canvasRef.current.offsetWidth
            }
        }

        window.addEventListener("resize", onResize)
        onResize()

        // cobe needs WebGL; bail out gracefully if it's unavailable so a missing
        // GL context can never crash the whole page.
        let globe: ReturnType<typeof createGlobe> | null = null
        try {
            globe = createGlobe(canvasRef.current!, {
                ...config,
                width: widthRef.current * 2,
                height: widthRef.current * 2,
                onRender: (state) => {
                    if (!pointerInteracting.current) phiRef.current += 0.005
                    state.phi = phiRef.current + rs.get()
                    state.width = widthRef.current * 2
                    state.height = widthRef.current * 2
                },
            })
            setTimeout(() => {
                if (canvasRef.current) canvasRef.current.style.opacity = "1"
            }, 0)
        } catch {
            // WebGL unavailable — leave the canvas hidden, page stays intact.
        }

        return () => {
            globe?.destroy()
            window.removeEventListener("resize", onResize)
        }
    }, [rs, config])

    return (
        <div
            className={cn(
                "absolute inset-0 mx-auto aspect-square w-full max-w-[600px]",
                className,
            )}
        >
            <canvas
                className="size-full opacity-0 transition-opacity duration-500"
                ref={canvasRef}
                onPointerDown={(e) => {
                    pointerInteracting.current = e.clientX
                    updatePointerInteraction(e.clientX)
                }}
                onPointerUp={() => updatePointerInteraction(null)}
                onPointerOut={() => updatePointerInteraction(null)}
                onMouseMove={(e) => updateMovement(e.clientX)}
                onTouchMove={(e) => e.touches[0] && updateMovement(e.touches[0].clientX)}
            />
        </div>
    )
}
