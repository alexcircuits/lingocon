import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { ResolvedTheme } from "@/lib/modules/theme"

function Swatch({ label, triplet }: { label: string; triplet?: string }) {
  if (!triplet) return null
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-10 w-10 shrink-0 rounded-lg border border-border/60 shadow-sm"
        style={{ backgroundColor: `hsl(${triplet})` }}
      />
      <div className="text-sm">
        <p className="font-medium">{label}</p>
        <p className="font-mono text-xs text-muted-foreground">hsl({triplet})</p>
      </div>
    </div>
  )
}

export function ThemePreviewPanel({
  theme,
  languageSlug,
  enabled,
}: {
  theme: ResolvedTheme | null
  languageSlug: string
  enabled: boolean
}) {
  if (!theme) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          This theme doesn&apos;t define any style values yet. Add it from the catalog to apply it.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Palette</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Swatch label="Primary" triplet={theme.primary} />
          <Swatch label="Accent" triplet={theme.accent} />
          <Swatch label="Background" triplet={theme.background} />
          {theme.radius && (
            <div className="flex items-center gap-3">
              <span
                className="h-10 w-10 shrink-0 border border-border/60 bg-muted"
                style={{ borderRadius: theme.radius }}
              />
              <div className="text-sm">
                <p className="font-medium">Corner radius</p>
                <p className="font-mono text-xs text-muted-foreground">{theme.radius}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(theme.bodyFont || theme.headingFont) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Typography</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {theme.headingFont && (
              <p style={{ fontFamily: theme.headingFont }} className="text-xl">
                Heading — {theme.headingFont}
              </p>
            )}
            {theme.bodyFont && (
              <p style={{ fontFamily: theme.bodyFont }}>
                Body text — {theme.bodyFont}. The quick brown fox jumps over the lazy dog.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          {enabled
            ? "This theme is enabled — it restyles your public language page for every visitor."
            : "This theme is added but not enabled. Enable it in your modules to apply it."}
        </p>
        <Link href={`/lang/${languageSlug}`} target="_blank">
          <Button variant="outline" size="sm">
            View public page
          </Button>
        </Link>
      </div>
    </div>
  )
}
