"use client"

import React, { useId } from "react"
import { useEffect, useState } from "react"
import Particles, { initParticlesEngine } from "@tsparticles/react"
import type { Container, Engine } from "@tsparticles/engine"
import { loadSlim } from "@tsparticles/slim"
import { cn } from "@/lib/utils"

type SparklesCoreProps = {
    id?: string
    className?: string
    background?: string
    minSize?: number
    maxSize?: number
    speed?: number
    particleColor?: string
    particleDensity?: number
}

export const SparklesCore = (props: SparklesCoreProps) => {
    const {
        id,
        className,
        background,
        minSize,
        maxSize,
        speed,
        particleColor,
        particleDensity,
    } = props
    const [init, setInit] = useState(false)

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine)
        }).then(() => {
            setInit(true)
        })
    }, [])

    const controls = {
        background: {
            color: {
                value: background || "transparent",
            },
        },
        fullScreen: {
            enable: false,
            zIndex: 1,
        },
        fpsLimit: 120,
        interactivity: {
            events: {
                onClick: {
                    enable: true,
                    mode: "push",
                },
                onHover: {
                    enable: false,
                    mode: "repulse",
                },
                resize: true, // Use boolean true instead of object
            },
            modes: {
                push: {
                    quantity: 4,
                },
                repulse: {
                    distance: 200,
                    duration: 0.4,
                },
            },
        },
        particles: {
            bounce: {
                horizontal: {
                    value: 1,
                },
                vertical: {
                    value: 1,
                },
            },
            color: {
                value: particleColor || "#ffffff",
            },
            move: {
                direction: "none", // Use specific string literal type if needed, but "none" allows any direction
                enable: true,
                outModes: {
                    default: "out",
                },
                random: false,
                speed: speed || 2,
                straight: false,
            },
            number: {
                density: {
                    enable: true,
                    width: 800, // Replaces unused area
                    height: 800,
                },
                value: particleDensity || 120,
            },
            opacity: {
                value: {
                    min: 0.1,
                    max: 1,
                },
                animation: {
                    enable: true,
                    speed: 1,
                    sync: false,
                },
            },
            shape: {
                type: "circle",
            },
            size: {
                value: {
                    min: minSize || 1,
                    max: maxSize || 3,
                },
            },
        },
        detectRetina: true,
    }

    const generatedId = useId()

    return (

        <div className={cn("opacity-0 animate-in fade-in duration-1000", className)}>
            {init && (
                <Particles
                    id={id || generatedId}
                    className={cn("h-full w-full")}
                    options={controls as any} // Cast to any to avoid strict type/interface mismatches with ts-particles options
                />
            )}
        </div>
    )
}
