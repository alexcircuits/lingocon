import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditLanguage } from "@/lib/auth-helpers"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Construction, Plus } from "lucide-react"
import { ModuleIcon } from "@/components/modules/module-icon"
import { getModuleTypeMeta } from "@/lib/modules/types"
import { formatSurfaces } from "@/lib/modules/surfaces"
import { DeclarativeTransformerPanel } from "@/components/modules/declarative-transformer-panel"
import { ThemePreviewPanel } from "@/components/modules/theme-preview-panel"
import { parseThemeData, type ResolvedTheme } from "@/lib/modules/theme"
import { ModuleFrame } from "@/components/modules/module-frame"
import { hasRuntimeBundle } from "@/lib/modules/runtime-bundles"
import { AddModuleButton } from "@/components/modules/add-module-button"

export const dynamic = "force-dynamic"

function rulesTextFromData(data: unknown): string {
  if (!data || typeof data !== "object") return ""
  const raw = (data as Record<string, unknown>).rules
  if (Array.isArray(raw)) return raw.map(String).join("\n")
  return typeof raw === "string" ? raw : ""
}

function resolveGranted(granted: unknown, declared: unknown): string[] {
  const g = granted as string[] | null
  const d = declared as string[] | null
  if (g && g.length > 0) return g
  return d ?? []
}

export default async function StudioModulePanelPage({
  params,
}: {
  params: Promise<{ slug: string; moduleSlug: string }>
}) {
  const { slug, moduleSlug } = await params
  const userId = await getUserId()

  const language = await prisma.language.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  })
  if (!language) notFound()

  const canEdit = await canEditLanguage(language.id, userId)
  if (!canEdit) notFound()

  const mod = await prisma.module.findUnique({
    where: { slug: moduleSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      icon: true,
      type: true,
      tier: true,
      summary: true,
      status: true,
      versions: {
        where: { yanked: false, publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: 1,
        select: { permissions: true, bundleCode: true, data: true },
      },
    },
  })
  if (!mod || mod.status !== "PUBLISHED" || !mod.versions[0]) notFound()

  const version = mod.versions[0]
  const declaredPermissions = (version.permissions as string[] | null) ?? []

  const install = userId
    ? await prisma.moduleInstall.findFirst({
        where: {
          userId,
          moduleId: mod.id,
          enabled: true,
          OR: [{ languageId: language.id }, { languageId: null }],
        },
        select: {
          id: true,
          enabled: true,
          grantedPermissions: true,
          version: { select: { data: true, bundleCode: true, permissions: true } },
        },
      })
    : null

  const typeMeta = getModuleTypeMeta(mod.type)
  const bundleCode = install?.version.bundleCode ?? version.bundleCode ?? null
  const grantedPermissions = resolveGranted(
    install?.grantedPermissions,
    install?.version.permissions ?? version.permissions
  )

  const isDeclarativeTransformer = mod.type === "TRANSFORMER" && mod.tier === "DECLARATIVE"
  const isTheme = mod.type === "THEME"
  const isSandboxWidget =
    mod.tier === "CLIENT_SANDBOX" && (Boolean(bundleCode) || hasRuntimeBundle(mod.slug))

  let rulesPreview = ""
  let theme: ResolvedTheme | null = null
  if (install) {
    if (isDeclarativeTransformer) {
      rulesPreview = rulesTextFromData(install.version.data ?? version.data)
    } else if (isTheme) {
      theme = parseThemeData(install.version.data ?? version.data)
    }
  }

  if (!install) {
    return (
      <div className="space-y-6">
        <ModuleHeader mod={mod} typeMeta={typeMeta} languageSlug={language.slug} />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div className="max-w-md space-y-2">
              <p className="font-medium">Add this module to use it</p>
              <p className="text-sm text-muted-foreground">
                <strong>{mod.name}</strong> isn&apos;t enabled for {language.name} yet. After you
                add it, it appears here and on the surfaces listed below.
              </p>
              <p className="text-xs text-muted-foreground">{formatSurfaces(mod.type)}</p>
            </div>
            <AddModuleButton
              moduleId={mod.id}
              permissions={declaredPermissions}
              isAuthenticated={Boolean(userId)}
              languageId={language.id}
              languageName={language.name}
            />
            <Link href={`/studio/lang/${language.slug}/modules`}>
              <Button variant="ghost" size="sm">
                Back to modules
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ModuleHeader mod={mod} typeMeta={typeMeta} languageSlug={language.slug} />

      {isDeclarativeTransformer ? (
        <DeclarativeTransformerPanel
          languageId={language.id}
          moduleId={mod.id}
          rulesPreview={rulesPreview}
        />
      ) : isTheme ? (
        <ThemePreviewPanel theme={theme} languageSlug={language.slug} enabled />
      ) : isSandboxWidget ? (
        <ModuleFrame
          slug={mod.slug}
          moduleId={mod.id}
          languageId={language.id}
          languageSlug={language.slug}
          permissions={grantedPermissions}
          bundleCode={bundleCode}
        />
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <Construction className="h-5 w-5 text-amber-500" />
            </div>
            <div className="max-w-md">
              <p className="font-medium">No runnable panel yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This module is installed, but it has no widget code or declarative payload yet. If
                you&apos;re the author, publish a version with bundle code or data from your{" "}
                <Link href={`/dashboard/modules`} className="text-primary hover:underline">
                  module dashboard
                </Link>
                .
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/modules/${mod.slug}`}>
                <Button variant="outline">Catalog page</Button>
              </Link>
              <Link href="/dashboard/modules/playground">
                <Button>Playground</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ModuleHeader({
  mod,
  typeMeta,
  languageSlug,
}: {
  mod: { name: string; summary: string | null; icon: string | null; type: import("@prisma/client").ModuleType }
  typeMeta: ReturnType<typeof getModuleTypeMeta>
  languageSlug: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <ModuleIcon name={mod.icon ?? typeMeta.icon} className="h-6 w-6" />
      </div>
      <div>
        <h1 className="font-bold text-2xl tracking-tight">{mod.name}</h1>
        {mod.summary && <p className="text-sm text-muted-foreground">{mod.summary}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {typeMeta.label} · {formatSurfaces(mod.type)}
        </p>
        <Link
          href={`/lang/${languageSlug}`}
          target="_blank"
          className="mt-2 inline-block text-xs text-primary hover:underline"
        >
          Preview on public page →
        </Link>
      </div>
    </div>
  )
}
