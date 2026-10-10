"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import type { IPAKeyboardProps } from "@/components/ipa-keyboard-panel"

export type { IPAKeyboardProps }

/** Holds the keyboard's width while its symbol tables load. */
function IPAKeyboardLoading() {
    return (
        <div aria-busy="true" className="flex h-64 w-[400px] max-w-[95vw] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
    )
}

/**
 * The IPA keyboard, code-split: its symbol tables and tooltips load the first time a keyboard
 * is shown (almost always from a popover the user opens), not with the settings, dictionary,
 * alphabet and phonology pages that offer one.
 */
export const IPAKeyboard = dynamic<IPAKeyboardProps>(
    () => import("@/components/ipa-keyboard-panel").then((m) => m.IPAKeyboard),
    { loading: IPAKeyboardLoading }
)
