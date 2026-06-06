"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Languages } from "lucide-react"

interface TransliterationToggleProps {
  onToggle: (showLatin: boolean) => void
  defaultShowLatin?: boolean
}

export function TransliterationToggle({
  onToggle,
  defaultShowLatin = false,
}: TransliterationToggleProps) {
  const [showLatin, setShowLatin] = useState(defaultShowLatin)

  const handleToggle = () => {
    const newValue = !showLatin
    setShowLatin(newValue)
    onToggle(newValue)
  }

  return (
    <Button
      type="button"
      variant={showLatin ? "secondary" : "outline"}
      size="sm"
      onClick={handleToggle}
      title={showLatin ? "Show Native Script" : "Show Romanization"}
      className="h-9 w-9 sm:w-auto px-0 sm:px-3 gap-2"
    >
      <Languages className="h-4 w-4" />
      <span className="hidden sm:inline">
        {showLatin ? "Native Script" : "Romanization"}
      </span>
    </Button>
  )
}

