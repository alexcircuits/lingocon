"use client"

import { cn } from "@/lib/utils"

interface GridBackgroundProps {
  children?: React.ReactNode
  className?: string
  showRadialGradient?: boolean
}

export function GridBackground({
  children,
  className,
  showRadialGradient = true,
}: GridBackgroundProps) {
  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-grid opacity-100" />
      
      {/* Radial gradient overlay */}
      {showRadialGradient && (
        <div className="absolute inset-0 bg-radial-top" />
      )}
      
      {/* Fade to background at edges */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(to right, hsl(var(--background)) 0%, transparent 10%, transparent 90%, hsl(var(--background)) 100%),
            linear-gradient(to bottom, transparent 0%, transparent 80%, hsl(var(--background)) 100%)
          `
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

interface DotBackgroundProps {
  children?: React.ReactNode
  className?: string
}

export function DotBackground({ children, className }: DotBackgroundProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <div className="absolute inset-0 bg-dots" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

interface GlowOrbProps {
  className?: string
  color?: "primary" | "secondary" | "accent"
  size?: "sm" | "md" | "lg" | "xl"
  blur?: "sm" | "md" | "lg" | "xl"
}

export function GlowOrb({
  className,
  color = "primary",
  size = "md",
  blur = "lg",
}: GlowOrbProps) {
  const colors = {
    primary: "bg-primary",
    secondary: "bg-violet-500",
    accent: "bg-emerald-500",
  }

  const sizes = {
    sm: "w-32 h-32",
    md: "w-64 h-64",
    lg: "w-96 h-96",
    xl: "w-[32rem] h-[32rem]",
  }

  const blurs = {
    sm: "blur-2xl",
    md: "blur-3xl",
    lg: "blur-[100px]",
    xl: "blur-[150px]",
  }

  return (
    <div
      className={cn(
        "absolute rounded-full opacity-20 pointer-events-none",
        colors[color],
        sizes[size],
        blurs[blur],
        className
      )}
    />
  )
}

interface BeamProps {
  className?: string
  width?: number
  duration?: number
}

export function Beam({ className, width = 2 }: BeamProps) {
  return (
    <div
      className={cn(
        "absolute bg-gradient-to-b from-transparent via-primary to-transparent opacity-50",
        className
      )}
      style={{ width: `${width}px` }}
    />
  )
}

