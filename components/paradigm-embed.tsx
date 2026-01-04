"use client"

import { useEffect, useState } from "react"
import { getParadigmById } from "@/app/actions/paradigm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Info, Loader2 } from "lucide-react"
import { IPASpeaker } from "@/components/ipa-speaker"
import { looksLikeIPA, extractIPA } from "@/lib/utils/ipa-detection"

interface ParadigmEmbedProps {
  paradigmId: string
  paradigmName?: string
  className?: string
}

export function ParadigmEmbed({ paradigmId, paradigmName, className }: ParadigmEmbedProps) {
  const [paradigm, setParadigm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchParadigm() {
      setLoading(true)
      setError(null)
      const result = await getParadigmById(paradigmId)
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        setParadigm(result.data)
      }
      setLoading(false)
    }

    if (paradigmId) {
      fetchParadigm()
    }
  }, [paradigmId])

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 border rounded-lg ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading paradigm...</span>
      </div>
    )
  }

  if (error || !paradigm) {
    return (
      <div className={`p-4 border border-destructive/50 rounded-lg bg-destructive/10 ${className}`}>
        <p className="text-sm text-destructive">
          {error || "Paradigm not found"}
        </p>
      </div>
    )
  }

  const slots = paradigm.slots as any
  const rows = Array.isArray(slots?.rows) ? slots.rows : []
  const columns = Array.isArray(slots?.columns) ? slots.columns : []
  const cells = slots?.cells || {}

  return (
    <Card className={`overflow-hidden border-border/60 shadow-sm ${className}`}>
      <CardHeader className="bg-muted/30 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-xl font-serif flex items-center gap-2">
            {paradigm.name || paradigmName}
          </CardTitle>
          {paradigm.notes && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <Info className="h-3.5 w-3.5" />
              {paradigm.notes}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {rows.length > 0 && columns.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px] bg-muted/50"></TableHead>
                  {columns.map((col: string, idx: number) => (
                    <TableHead key={idx} className="bg-muted/50 font-semibold min-w-[150px]">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: string, rowIdx: number) => (
                  <TableRow key={rowIdx} className="hover:bg-muted/5">
                    <TableCell className="font-medium bg-muted/10 text-muted-foreground border-r border-border/40">
                      {row}
                    </TableCell>
                    {columns.map((_: string, colIdx: number) => {
                      const cellValue = cells[`${rowIdx}-${colIdx}`] || "-"
                      const isIPA = cellValue !== "-" && looksLikeIPA(cellValue)
                      const ipaValue = isIPA ? extractIPA(cellValue) : null
                      const isEmpty = cellValue === "-" || cellValue === ""

                      return (
                        <TableCell key={colIdx} className={isEmpty ? "text-muted-foreground/30" : ""}>
                          {isIPA && ipaValue ? (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{cellValue}</span>
                              <IPASpeaker ipa={ipaValue} size="sm" />
                            </div>
                          ) : (
                            <span className={isEmpty ? "" : "font-medium"}>{cellValue}</span>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm italic">
            No table structure defined
          </div>
        )}
      </CardContent>
    </Card>
  )
}

