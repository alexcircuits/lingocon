"use client"

import dynamic from "next/dynamic"
import type { ParentLanguageCardProps } from "./parent-language-card-impl"
import { SettingsCardSkeleton } from "./settings-card-skeleton"

export type { ParentLanguageCardProps }

/**
 * The family/parent card, code-split from the settings page: its two search comboboxes (cmdk),
 * the family tree and the sync dialog sit below the main form. It still renders on the server;
 * its code loads after the page is interactive and hydrates the card in place.
 */
export const ParentLanguageCard = dynamic<ParentLanguageCardProps>(
  () => import("./parent-language-card-impl").then((m) => m.ParentLanguageCard),
  { loading: () => <SettingsCardSkeleton className="min-h-[260px]" /> }
)
