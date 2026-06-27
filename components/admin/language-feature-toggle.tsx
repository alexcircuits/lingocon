"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Star, Loader2 } from "lucide-react"
import { setLanguageFeatured } from "@/app/actions/admin-content"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface LanguageFeatureToggleProps {
  languageId: string
  initialFeatured: boolean
}

export function LanguageFeatureToggle({ languageId, initialFeatured }: LanguageFeatureToggleProps) {
  const [featured, setFeatured] = useState(initialFeatured)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleToggle = async () => {
    const next = !featured
    setIsLoading(true)
    try {
      await setLanguageFeatured(languageId, next)
      setFeatured(next)
      router.refresh()
    } catch (error) {
      console.error("Failed to toggle featured:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={featured ? "default" : "outline"}
      disabled={isLoading}
      onClick={handleToggle}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star className={cn("h-4 w-4", featured && "fill-current")} />
      )}
      {featured ? "Featured" : "Feature"}
    </Button>
  )
}
