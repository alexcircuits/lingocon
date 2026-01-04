"use client"

import * as React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input, type InputProps } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Keyboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { IPAKeyboard } from "@/components/ipa-keyboard"

export interface IPAInputProps extends Omit<InputProps, "onChange"> {
    value?: string
    onChange?: (value: string) => void
    onBlur?: React.FocusEventHandler<HTMLInputElement>
}

const IPAInput = React.forwardRef<HTMLInputElement, IPAInputProps>(
    ({ className, value, onChange, onBlur, disabled, ...props }, ref) => {
        const [isOpen, setIsOpen] = useState(false)
        const [cursorPosition, setCursorPosition] = useState<number | null>(null)
        const inputRef = useRef<HTMLInputElement | null>(null)

        // Handle ref forwarding
        const setRefs = useCallback(
            (node: HTMLInputElement | null) => {
                inputRef.current = node
                if (typeof ref === "function") {
                    ref(node)
                } else if (ref) {
                    ref.current = node
                }
            },
            [ref]
        )

        // Track cursor position
        const handleSelect = useCallback(() => {
            if (inputRef.current) {
                setCursorPosition(inputRef.current.selectionStart)
            }
        }, [])

        // Insert symbol at cursor position (doesn't close popover)
        const handleSymbolSelect = useCallback(
            (symbol: string) => {
                if (!onChange) return

                const currentValue = value || ""
                const position = cursorPosition ?? currentValue.length

                const newValue =
                    currentValue.slice(0, position) + symbol + currentValue.slice(position)

                onChange(newValue)

                // Update cursor position for next insertion
                const newPos = position + symbol.length
                setCursorPosition(newPos)

                // Don't close the popover - user can continue inserting symbols
                // Focus is handled by the popover staying open
            },
            [value, onChange, cursorPosition]
        )

        // Delete last character
        const handleDelete = useCallback(() => {
            if (!onChange || !value) return

            const newValue = value.slice(0, -1)
            onChange(newValue)
            setCursorPosition(newValue.length)
        }, [value, onChange])

        // Handle input change
        const handleInputChange = useCallback(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                onChange?.(e.target.value)
                setCursorPosition(e.target.selectionStart)
            },
            [onChange]
        )

        // Close popover on Escape
        useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === "Escape" && isOpen) {
                    setIsOpen(false)
                }
            }

            document.addEventListener("keydown", handleKeyDown)
            return () => document.removeEventListener("keydown", handleKeyDown)
        }, [isOpen])

        return (
            <div className="relative flex items-center">
                <Input
                    ref={setRefs}
                    className={cn("pr-10 font-mono", className)}
                    value={value}
                    onChange={handleInputChange}
                    onSelect={handleSelect}
                    onBlur={onBlur}
                    disabled={disabled}
                    {...props}
                />
                <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={disabled}
                            className="absolute right-1 h-8 w-8 text-muted-foreground hover:text-foreground"
                            aria-label="Open IPA keyboard"
                        >
                            <Keyboard className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        sideOffset={8}
                        className="w-auto p-0"
                        onOpenAutoFocus={(e) => {
                            // Prevent focus from moving to popover
                            e.preventDefault()
                        }}
                        onInteractOutside={(e) => {
                            // Close when clicking outside the popover
                            // This is the default behavior we want to keep
                        }}
                    >
                        <IPAKeyboard
                            onSelect={handleSymbolSelect}
                            onDelete={handleDelete}
                            onClose={() => setIsOpen(false)}
                            currentValue={value || ""}
                        />
                    </PopoverContent>
                </Popover>
            </div>
        )
    }
)

IPAInput.displayName = "IPAInput"

export { IPAInput }
