import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ModuleIcon } from "@/components/modules/module-icon"
import { AddModuleButton } from "@/components/modules/add-module-button"
import { ModuleFrame } from "@/components/modules/module-frame"
import { getModuleTypeMeta } from "@/lib/modules/types"
import { hasRuntimeBundle } from "@/lib/modules/runtime-bundles"
import type { PublicReaderModule } from "@/lib/services/module"

/**
 * Owner-enabled reader widgets / visualizers on the public language page.
 * Visitors see the same set; signed-in users can add account-wide copies.
 */
export function ReaderModulesSection({
  modules,
  visitorInstalls,
  isAuthenticated,
  languageId,
  languageSlug,
}: {
  modules: PublicReaderModule[]
  /** moduleId → the visitor's account-wide install id, if added. */
  visitorInstalls: Record<string, string>
  isAuthenticated: boolean
  languageId: string
  languageSlug: string
}) {
  if (modules.length === 0) return null

  return (
    <section>
      <div className="mb-6 px-2">
        <h2 className="flex items-center gap-2 font-serif text-2xl font-medium">
          Tools
          <div className="ml-4 h-px flex-1 bg-border" />
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Interactive modules the language owner enabled — they run live below.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {modules.map((m) => {
          const typeMeta = getModuleTypeMeta(m.type)
          return (
            <div
              key={m.moduleId}
              className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card p-6 ring-1 ring-border/50"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ModuleIcon name={m.icon ?? typeMeta.icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/modules/${m.slug}`} className="font-medium hover:text-primary">
                    {m.name}
                  </Link>
                  <div className="mt-1">
                    <Badge variant="outline" className="text-[11px]">
                      {typeMeta.label}
                    </Badge>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{m.summary || typeMeta.description}</p>

              {m.bundleCode || hasRuntimeBundle(m.slug) ? (
                <ModuleFrame
                  slug={m.slug}
                  moduleId={m.moduleId}
                  languageId={languageId}
                  languageSlug={languageSlug}
                  permissions={m.permissions}
                  bundleCode={m.bundleCode}
                />
              ) : null}

              <div className="mt-auto flex items-center justify-end gap-2">
                <AddModuleButton
                  moduleId={m.moduleId}
                  permissions={m.permissions}
                  isAuthenticated={isAuthenticated}
                  installId={visitorInstalls[m.moduleId] ?? null}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
