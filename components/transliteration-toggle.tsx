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
      variant="outline"
      size="sm"
      onClick={handleToggle}
      className="gap-2"
    >
      <Languages className="h-4 w-4" />
      {showLatin ? "Show Native Script" : "Show Latin Transliteration"}
    </Button>
  )
}

