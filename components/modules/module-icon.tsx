import {
  PanelsTopLeft,
  LayoutGrid,
  Blocks,
  Workflow,
  Sparkles,
  Download,
  Upload,
  ChartScatter,
  BadgeCheck,
  Palette,
  Package,
  BarChart3,
  ListChecks,
  GraduationCap,
  Type,
  Target,
  type LucideProps,
} from "lucide-react"

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  PanelsTopLeft,
  LayoutGrid,
  Blocks,
  Workflow,
  Sparkles,
  Download,
  Upload,
  ChartScatter,
  BadgeCheck,
  Palette,
  Package,
  BarChart3,
  ListChecks,
  GraduationCap,
  Type,
  Target,
}

/**
 * Renders a module's icon. `name` may be a known Lucide icon name from
 * `MODULE_TYPES`/the author, or a single emoji. Falls back to a package glyph.
 */
export function ModuleIcon({ name, className }: { name?: string | null; className?: string }) {
  if (name && !ICONS[name] && /\p{Extended_Pictographic}/u.test(name)) {
    return <span className={className}>{name}</span>
  }
  const Icon = (name && ICONS[name]) || Package
  return <Icon className={className} />
}
