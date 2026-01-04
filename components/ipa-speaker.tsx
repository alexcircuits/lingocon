"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Volume2, Loader2, AlertCircle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"

interface IPASpeakerProps {
  ipa: string
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "ghost" | "outline" | "default"
}

export function IPASpeaker({
  ipa,
  className = "",
  size = "sm",
  variant = "ghost",
}: IPASpeakerProps) {
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Clean up audio URL when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl && audioUrl.startsWith("data:")) {
        // Revoke object URL if it's a blob URL
        // Note: data URLs don't need to be revoked, but blob URLs do
        if (audioUrl.startsWith("blob:")) {
          URL.revokeObjectURL(audioUrl)
        }
      }
    }
  }, [audioUrl])

  const handlePlay = async () => {
    if (!ipa || ipa.trim().length === 0) {
      toast.error("No IPA pronunciation available")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/pronounce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ipa }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate pronunciation")
      }

      if (data.audioUrl) {
        setAudioUrl(data.audioUrl)
        // Play audio after a short delay to ensure it's loaded
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch((err) => {
              console.error("Error playing audio:", err)
              toast.error("Could not play audio. Please check your browser settings.")
            })
          }
        }, 100)
      } else {
        throw new Error("No audio URL returned")
      }

      // Show warning if present
      if (data.warning) {
        toast.warning(data.warning, {
          description: "This IPA reader may not support some symbols.",
        })
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Pronunciation could not be generated"
      setError(errorMessage)
      toast.error("Audio unavailable", {
        description: "Audio unavailable for this IPA pronunciation. The IPA reader service may not be configured.",
      })
    } finally {
      setLoading(false)
    }
  }

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            <Button
              variant={variant}
              size={size === "sm" ? "icon" : "icon"}
              onClick={handlePlay}
              disabled={loading || !ipa || ipa.trim().length === 0}
              className={`${className} ${size === "sm" ? "h-6 w-6" : ""}`}
              aria-label="Play IPA pronunciation (approximate)"
              type="button"
            >
              {loading ? (
                <Loader2 className={`${sizeClasses[size]} animate-spin`} />
              ) : error ? (
                <AlertCircle className={sizeClasses[size]} />
              ) : (
                <Volume2 className={sizeClasses[size]} />
              )}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">IPA pronunciation (approximate)</p>
            <p className="text-xs text-muted-foreground">
              This audio is generated from IPA notation and may not reflect all accents or
              phonological nuances.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          controls={false}
          autoPlay={false}
          preload="none"
          className="hidden"
          onEnded={() => {
            // Clean up after playback
            setAudioUrl(null)
          }}
          onError={(e) => {
            console.error("Audio playback error:", e)
            toast.error("Error playing audio")
            setAudioUrl(null)
            setError("Playback error")
          }}
        />
      )}
    </TooltipProvider>
  )
}

