import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table2, Info } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"

async function getLanguage(slug: string) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      paradigms: {
        where: {
          // Only show paradigms if language is public
          // For private languages, paradigms are only visible to owners/collaborators
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          name: true,
          slots: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      _count: {
        select: {
          paradigms: true,
        },
      },
    },
  })

  if (!language) {
    return null
  }

  // Only show public languages
  if (language.visibility === "PRIVATE") {
    return null
  }

  return language
}

export default async function PublicParadigmsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const language = await getLanguage(slug)

  if (!language) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-medium tracking-tight mb-2">
          Paradigm Tables
        </h1>
        <p className="text-muted-foreground">
          Morphological patterns, declensions, and conjugations for {language.name}
        </p>
      </div>

      {language.paradigms.length === 0 ? (
        <EmptyState
          icon={Table2}
          title="No paradigm tables yet"
          description="Paradigm tables for declensions and conjugations will appear here when they are added."
        />
      ) : (
        <div className="grid gap-6">
          {language.paradigms.map((paradigm) => {
            const slots = paradigm.slots as any
            const rows = Array.isArray(slots?.rows) ? slots.rows : []
            const columns = Array.isArray(slots?.columns) ? slots.columns : []
            const cells = slots?.cells || {}

            return (
              <Card key={paradigm.id} className="overflow-hidden border-border/60 shadow-sm">
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-serif flex items-center gap-2">
                        {paradigm.name}
                      </CardTitle>
                      {paradigm.notes && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                          <Info className="h-3.5 w-3.5" />
                          {paradigm.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {rows.length > 0 && columns.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="border border-border/60 p-2 text-left font-medium bg-muted/30"></th>
                            {columns.map((col: string, colIdx: number) => (
                              <th
                                key={colIdx}
                                className="border border-border/60 p-2 text-left font-medium bg-muted/30"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row: string, rowIdx: number) => (
                            <tr key={rowIdx}>
                              <td className="border border-border/60 p-2 font-medium bg-muted/20">
                                {row}
                              </td>
                              {columns.map((_: string, colIdx: number) => {
                                const cellKey = `${rowIdx}-${colIdx}`
                                const cellValue = cells[cellKey] || ""
                                return (
                                  <td
                                    key={colIdx}
                                    className="border border-border/60 p-2"
                                  >
                                    {cellValue || (
                                      <span className="text-muted-foreground/50">—</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Table2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>Paradigm table structure not yet defined</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

