/**
 * Where each module type appears in the product — single source of truth for
 * studio nav, public pages, and in-app copy.
 */
import type { ModuleType } from "@prisma/client"

export type ModuleSurface =
  | "studio_tab"
  | "studio_panel"
  | "public_tools"
  | "public_theme"
  | "dictionary_transform"

export const SURFACE_LABELS: Record<
  ModuleSurface,
  { label: string; short: string }
> = {
  studio_tab: { label: "Studio sidebar", short: "Studio" },
  studio_panel: { label: "Studio module panel", short: "Panel" },
  public_tools: { label: "Public language page (Tools)", short: "Public tools" },
  public_theme: { label: "Public language page (theme)", short: "Public theme" },
  dictionary_transform: {
    label: "Dictionary transform in studio",
    short: "Transform",
  },
}

/** Surfaces each module type uses when installed for a language. */
export function surfacesForType(type: ModuleType): ModuleSurface[] {
  switch (type) {
    case "STUDIO_PANEL":
      return ["studio_tab", "studio_panel"]
    case "READER_WIDGET":
    case "VISUALIZER":
      return ["studio_tab", "studio_panel", "public_tools"]
    case "TRANSFORMER":
      return ["studio_tab", "studio_panel", "dictionary_transform"]
    case "THEME":
      return ["studio_tab", "studio_panel", "public_theme"]
    case "GENERATOR":
    case "EXPORTER":
    case "IMPORTER":
    case "VALIDATOR":
      return ["studio_tab", "studio_panel"]
    case "CONTENT_BLOCK":
      return ["studio_panel"]
    default:
      return ["studio_panel"]
  }
}

export function hasStudioNav(type: ModuleType): boolean {
  return surfacesForType(type).includes("studio_tab")
}

export function hasPublicReader(type: ModuleType): boolean {
  return surfacesForType(type).includes("public_tools")
}

export function hasPublicTheme(type: ModuleType): boolean {
  return surfacesForType(type).includes("public_theme")
}

/** Human-readable list for catalog cards and detail pages. */
export function formatSurfaces(type: ModuleType): string {
  return surfacesForType(type)
    .map((s) => SURFACE_LABELS[s].label)
    .join(" · ")
}

/** Module types that contribute a dynamic tab in the studio sidebar. */
export const STUDIO_NAV_TYPES: ModuleType[] = [
  "STUDIO_PANEL",
  "READER_WIDGET",
  "VISUALIZER",
  "TRANSFORMER",
  "THEME",
  "GENERATOR",
  "EXPORTER",
  "IMPORTER",
  "VALIDATOR",
]
