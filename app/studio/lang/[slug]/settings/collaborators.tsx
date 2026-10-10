"use client"

import dynamic from "next/dynamic"
import type { CollaboratorsProps } from "./collaborators-impl"
import { SettingsCardSkeleton } from "./settings-card-skeleton"

export type { CollaboratorsProps }

/**
 * The collaborator and ownership cards, code-split from the settings page (they sit below the
 * main form, and the user search inside them brings cmdk). They still render on the server; their
 * code loads after the page is interactive. The collaborator list is fetched once it has loaded.
 */
export const Collaborators = dynamic<CollaboratorsProps>(
  () => import("./collaborators-impl").then((m) => m.Collaborators),
  { loading: () => <SettingsCardSkeleton className="min-h-[220px]" /> }
)

export const TransferOwnershipCard = dynamic<{ languageId: string; languageSlug: string }>(
  () => import("./collaborators-impl").then((m) => m.TransferOwnershipCard),
  { loading: () => <SettingsCardSkeleton className="min-h-[200px] border-destructive/40" /> }
)
