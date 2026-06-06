"use client"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Mic, Square, Play, Trash2, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface AudioRecorderProps {
  onRecordingComplete: (url: string) => void
  onRecordingDelete: () => void
  initialAudioUrl?: string | null
  className?: string
}

export function AudioRecorder({
  onRecordingComplete,
  onRecordingDelete,
  initialAudioUrl,
  className,
}: AudioRecorderProps) {
  const t = useTranslations("audioRecorder")
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl || null)
  const [recordingDuration, setRecordingDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  useEffect(() => {
    if (initialAudioUrl !== undefined) {
      setAudioUrl(initialAudioUrl || null)
    }
  }, [initialAudioUrl])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop())
        
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorder.mimeType 
          })
          await uploadAudio(audioBlob)
        }
      }

      mediaRecorder.start(200) // Collect data every 200ms
      setIsRecording(true)
      setRecordingDuration(0)
      
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)

    } catch (error) {
      console.error("Error accessing microphone:", error)
      toast.error(t("noMic"), {
        description: t("checkPermissions"),
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const uploadAudio = async (blob: Blob) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      // Use webm extension if type is webm, otherwise m4a
      const ext = blob.type.includes('webm') ? 'webm' : 'm4a'
      const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: blob.type })
      
      formData.append("file", file)
      formData.append("type", "audio")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Upload failed")
      }

      setAudioUrl(data.url)
      onRecordingComplete(data.url)
      toast.success(t("saved"))
    } catch (error) {
      console.error("Error uploading audio:", error)
      toast.error(t("saveFailed"))
    } finally {
      setIsUploading(false)
    }
  }

  const togglePlayback = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    } else {
      audioRef.current.play().catch(error => {
        console.error("Error playing audio:", error)
        toast.error(t("playFailed"))
      })
      setIsPlaying(true)
    }
  }

  const handleDelete = () => {
    setAudioUrl(null)
    onRecordingDelete()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {audioUrl ? (
        <div className="flex items-center gap-2 bg-muted/50 rounded-md p-1 pl-2 border border-border/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 rounded-full"
            onClick={togglePlayback}
          >
            {isPlaying ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
          </Button>
          
          <div className="h-1.5 w-16 bg-muted-foreground/20 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full bg-primary transition-all duration-300",
                isPlaying ? "w-full" : "w-0"
              )}
            />
          </div>
          
          <div className="flex items-center gap-1 border-l border-border/50 pl-2 ml-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleDelete}
              title={t("recordAgain")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : isRecording ? (
        <div className="flex items-center gap-3 bg-destructive/10 text-destructive rounded-md p-1 pl-3 border border-destructive/20 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-destructive animate-ping" />
            <span className="text-xs font-medium tabular-nums w-8">
              {formatTime(recordingDuration)}
            </span>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-7 w-7 p-0 rounded-full"
            onClick={stopRecording}
          >
            <Square className="h-3 w-3 fill-current" />
          </Button>
        </div>
      ) : isUploading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("saving")}</span>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={startRecording}
        >
          <Mic className="h-3.5 w-3.5" />
          {t("recordPronunciation")}
        </Button>
      )}
    </div>
  )
}
