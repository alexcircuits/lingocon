"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react"

export interface TourStep {
  id: string
  title: string
  description: string
  target?: string // CSS selector for element to highlight
  position?: "top" | "bottom" | "left" | "right" | "center"
  action?: {
    label: string
    onClick: () => void
  }
  image?: string
}

interface TourProps {
  steps: TourStep[]
  onComplete?: () => void
  onSkip?: () => void
  storageKey?: string
}

export function Tour({ steps, onComplete, onSkip, storageKey = "tour-completed" }: TourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    // Check if tour has been completed
    const completed = localStorage.getItem(storageKey)
    if (!completed && steps.length > 0) {
      setIsOpen(true)
    }
  }, [storageKey, steps.length])

  useEffect(() => {
    if (!isOpen || currentStep >= steps.length) return

    const step = steps[currentStep]
    if (step.target) {
      const element = document.querySelector(step.target) as HTMLElement
      if (element) {
        setHighlightedElement(element)
        element.scrollIntoView({ behavior: "smooth", block: "center" })
      } else {
        setHighlightedElement(null)
      }
    } else {
      setHighlightedElement(null)
    }
  }, [currentStep, isOpen, steps])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    localStorage.setItem(storageKey, "true")
    setIsOpen(false)
    setHighlightedElement(null)
    onComplete?.()
  }

  const handleSkip = () => {
    localStorage.setItem(storageKey, "true")
    setIsOpen(false)
    setHighlightedElement(null)
    onSkip?.()
  }

  if (!isOpen || steps.length === 0) return null

  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <>
      {/* Overlay with highlight */}
      {highlightedElement && (
        <div
          className="fixed inset-0 z-40 pointer-events-none"
          style={{
            background: "rgba(0, 0, 0, 0.5)",
            clipPath: `polygon(
              0% 0%, 
              0% 100%, 
              ${highlightedElement.offsetLeft}px 100%, 
              ${highlightedElement.offsetLeft}px ${highlightedElement.offsetTop}px, 
              ${highlightedElement.offsetLeft + highlightedElement.offsetWidth}px ${highlightedElement.offsetTop}px, 
              ${highlightedElement.offsetLeft + highlightedElement.offsetWidth}px ${highlightedElement.offsetTop + highlightedElement.offsetHeight}px, 
              ${highlightedElement.offsetLeft}px ${highlightedElement.offsetTop + highlightedElement.offsetHeight}px, 
              ${highlightedElement.offsetLeft}px 100%, 
              100% 100%, 
              100% 0%
            )`,
          }}
        />
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-xl">Welcome to LingoCon!</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              Step {currentStep + 1} of {steps.length}
            </DialogDescription>
            <div className="mt-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            </div>

            {step.image && (
              <div className="rounded-lg border bg-muted/50 p-4 relative aspect-video">
                <Image src={step.image} alt={step.title} fill className="rounded-md object-cover" />
              </div>
            )}

            {step.action && (
              <Button
                onClick={() => {
                  step.action?.onClick()
                  handleNext()
                }}
                className="w-full"
              >
                {step.action.label}
              </Button>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="ghost" onClick={handleSkip}>
              Skip Tour
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={handleNext}>
                {currentStep === steps.length - 1 ? "Get Started" : "Next"}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

