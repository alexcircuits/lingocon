"use client"

import { useState, useTransition } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { toggleFavorite } from "@/app/actions/favorite"
import { cn } from "@/lib/utils"

interface FavoriteButtonProps {
  languageId: string
  isFavorite: boolean
  favoriteCount: number
  onToggle?: (newIsFavorite: boolean, newCount: number) => void
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  showCount?: boolean
  className?: string
}

export function FavoriteButton({
  languageId,
  isFavorite: initialIsFavorite,
  favoriteCount: initialFavoriteCount,
  onToggle,
  variant = "outline",
  size = "default",
  showCount = true,
  className,
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite)
  const [favoriteCount, setFavoriteCount] = useState(initialFavoriteCount)
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    startTransition(async () => {
      try {
        const result = await toggleFavorite({ languageId })

        if (result.error) {
          toast.error(result.error)
          return
        }

        // Handle response format
        const newIsFavorite = result.data?.isFavorite ?? !isFavorite
        const newCount = result.data?.favoriteCount ?? favoriteCount + (newIsFavorite ? (isFavorite ? 0 : 1) : (isFavorite ? -1 : 0))

        setIsFavorite(newIsFavorite)
        setFavoriteCount(newCount)
        onToggle?.(newIsFavorite, newCount)

        toast.success(
          newIsFavorite
            ? "Added to favorites"
            : "Removed from favorites"
        )
      } catch (error) {
        toast.error("Failed to update favorite")
      }
    })
  }

  const sizeClasses = {
    default: "h-9 px-4",
    sm: "h-8 px-3 text-sm",
    lg: "h-10 px-5 text-lg",
    icon: "h-9 w-9",
  }

  const iconSizes = {
    default: "h-4 w-4",
    sm: "h-3.5 w-3.5",
    lg: "h-5 w-5",
    icon: "h-4 w-4",
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={isPending}
      className={cn(
        sizeClasses[size],
        isFavorite && "bg-rose-500/10 border-rose-500/20 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700",
        !isFavorite && "hover:bg-rose-500/5 hover:border-rose-500/20 hover:text-rose-600",
        className
      )}
    >
      <Heart
        className={cn(
          iconSizes[size],
          isFavorite && "fill-current",
          "transition-all"
        )}
      />
      {showCount && (
        <span className="ml-2 font-medium">{favoriteCount}</span>
      )}
    </Button>
  )
}
