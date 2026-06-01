/**
 * Shared, UI-safe metadata for the Modules marketplace.
 *
 * This file contains NO server-only imports so it can be used from both client
 * components (catalog filters, badges) and server code. See
 * `docs/MODULES_MARKETPLACE.md` for the overall design.
 */
import type { ModuleType, ModuleTier, ModuleStatus } from "@prisma/client"

export type ModuleTypeMeta = {
  type: ModuleType
  label: string
  /** Lucide icon name (resolved in the UI layer). */
  icon: string
  description: string
  /** The tier this category runs in. */
  tier: ModuleTier
  /** Marked priority for the initial rollout. */
  priority?: boolean
}

/** Ordered metadata for every module category, used for filters and cards. */
export const MODULE_TYPES: ModuleTypeMeta[] = [
  {
    type: "STUDIO_PANEL",
    label: "Studio panel",
    icon: "PanelsTopLeft",
    description: "Adds a tool/tab inside the studio.",
    tier: "CLIENT_SANDBOX",
    priority: true,
  },
  {
    type: "READER_WIDGET",
    label: "Reader widget",
    icon: "LayoutGrid",
    description: "Embeds an interactive block on a public language page.",
    tier: "CLIENT_SANDBOX",
    priority: true,
  },
  {
    type: "CONTENT_BLOCK",
    label: "Content block",
    icon: "Blocks",
    description: "A new editor block for grammar pages and articles.",
    tier: "CLIENT_SANDBOX",
  },
  {
    type: "TRANSFORMER",
    label: "Transformer",
    icon: "Workflow",
    description: "Transforms lexicon text (sound changes, romanizers).",
    tier: "DECLARATIVE",
  },
  {
    type: "GENERATOR",
    label: "Generator",
    icon: "Sparkles",
    description: "Generates words, names, or sentences from rules.",
    tier: "CLIENT_SANDBOX",
  },
  {
    type: "EXPORTER",
    label: "Exporter",
    icon: "Download",
    description: "Exports a language's data to another format.",
    tier: "CLIENT_SANDBOX",
  },
  {
    type: "IMPORTER",
    label: "Importer",
    icon: "Upload",
    description: "Imports data from external conlang tools.",
    tier: "CLIENT_SANDBOX",
  },
  {
    type: "VISUALIZER",
    label: "Visualizer",
    icon: "ChartScatter",
    description: "Charts and diagrams over a language's data.",
    tier: "CLIENT_SANDBOX",
  },
  {
    type: "VALIDATOR",
    label: "Validator",
    icon: "BadgeCheck",
    description: "Checks a language for consistency problems.",
    tier: "CLIENT_SANDBOX",
  },
  {
    type: "THEME",
    label: "Theme & font",
    icon: "Palette",
    description: "Restyles a language's public page.",
    tier: "DECLARATIVE",
  },
]

const TYPE_META_BY_TYPE = new Map(MODULE_TYPES.map((m) => [m.type, m]))

export function getModuleTypeMeta(type: ModuleType): ModuleTypeMeta {
  return TYPE_META_BY_TYPE.get(type) ?? MODULE_TYPES[0]
}

/** Capability strings a module may declare and a user may grant. */
export const MODULE_PERMISSIONS = [
  "read:dictionary",
  "read:phonology",
  "read:paradigms",
  "read:grammar",
  "read:texts",
  "write:dictionary",
  "write:paradigms",
  "write:grammar",
  "storage",
  "net:fetch",
  "export",
] as const

export type ModulePermission = (typeof MODULE_PERMISSIONS)[number]

export const PERMISSION_LABELS: Record<ModulePermission, string> = {
  "read:dictionary": "Read your dictionary entries",
  "read:phonology": "Read your phonology and sounds",
  "read:paradigms": "Read your paradigm tables",
  "read:grammar": "Read your grammar pages",
  "read:texts": "Read your texts and articles",
  "write:dictionary": "Add or edit dictionary entries",
  "write:paradigms": "Add or edit paradigm tables",
  "write:grammar": "Add or edit grammar pages",
  storage: "Store its own settings and data",
  "net:fetch": "Make network requests (via a proxy)",
  export: "Produce downloadable files",
}

/** Statuses that mean a module is publicly visible in the catalog. */
export const PUBLIC_MODULE_STATUSES: ModuleStatus[] = ["PUBLISHED"]

export function averageRating(ratingSum: number, ratingCount: number): number {
  if (ratingCount <= 0) return 0
  return Math.round((ratingSum / ratingCount) * 10) / 10
}
