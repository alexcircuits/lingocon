import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Blocks, Flag } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ModuleIcon } from "@/components/modules/module-icon"
import { getModuleTypeMeta } from "@/lib/modules/types"
import {
  AdminModuleStatusControl,
  AdminYankControl,
  AdminReportControls,
} from "@/components/admin/admin-module-controls"

export const dynamic = "force-dynamic"

export default async function AdminModulesPage() {
  const [modules, openReports] = await Promise.all([
    prisma.module.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        author: { select: { name: true, email: true } },
        versions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, version: true, yanked: true } },
        _count: { select: { reports: { where: { status: "OPEN" } }, installs: true } },
      },
    }),
    prisma.moduleReport.findMany({
      where: { status: { in: ["OPEN", "REVIEWING"] } },
      orderBy: { createdAt: "desc" },
      include: {
        module: { select: { slug: true, name: true } },
        reporter: { select: { name: true, email: true } },
      },
    }),
  ])

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 md:py-10">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Blocks className="h-6 w-6 text-primary" />
          Modules
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Moderate published modules and handle abuse reports.
        </p>
      </div>

      {/* Open reports */}
      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
          <Flag className="h-4 w-4 text-destructive" />
          Open reports
          <Badge variant="secondary">{openReports.length}</Badge>
        </h2>
        {openReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open reports. 🎉</p>
        ) : (
          <div className="space-y-3">
            {openReports.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/modules/${r.module.slug}`} className="font-medium hover:text-primary">
                      {r.module.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      by {r.reporter.name ?? r.reporter.email ?? "Unknown"} ·{" "}
                      {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <AdminReportControls reportId={r.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* All modules */}
      <section>
        <h2 className="mb-3 text-lg font-medium">All modules ({modules.length})</h2>
        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No modules yet.</p>
        ) : (
          <div className="space-y-3">
            {modules.map((m) => {
              const typeMeta = getModuleTypeMeta(m.type)
              const latest = m.versions[0]
              return (
                <Card key={m.id}>
                  <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ModuleIcon name={m.icon ?? typeMeta.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/modules/${m.slug}`} className="truncate font-medium hover:text-primary">
                            {m.name}
                          </Link>
                          {m._count.reports > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              {m._count.reports} report{m._count.reports === 1 ? "" : "s"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {typeMeta.label} · {m.author.name ?? m.author.email} · {m._count.installs} adds
                          {latest ? ` · v${latest.version}${latest.yanked ? " (yanked)" : ""}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <AdminModuleStatusControl moduleId={m.id} status={m.status} />
                      {latest && <AdminYankControl versionId={latest.id} yanked={latest.yanked} />}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
