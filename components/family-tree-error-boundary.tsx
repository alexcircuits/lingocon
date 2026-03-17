"use client"

import React, { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
  /** Fallback message to show when the tree fails to render */
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary for family tree components.
 * Catches rendering errors (e.g., corrupted parentage, infinite recursion)
 * and shows a friendly fallback instead of crashing the entire page.
 */
export class FamilyTreeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[FamilyTree Error]", error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium text-sm">
              {this.props.fallbackMessage || "Failed to render language family tree"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            This may be caused by corrupted parent-child relationships or an 
            overly deep family tree. Try refreshing the page.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
