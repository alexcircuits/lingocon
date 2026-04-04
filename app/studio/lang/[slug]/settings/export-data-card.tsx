"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FileDown } from "lucide-react"

interface ExportDataCardProps {
  languageId: string
  isPending: boolean
}

export function ExportDataCard({ languageId, isPending }: ExportDataCardProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Export Data</h3>
          <p className="text-sm text-muted-foreground">
            Download your language data in various formats.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.open(`/api/export/docx?languageId=${languageId}`, "_blank")
            }}
            disabled={isPending}
            className="h-auto py-4 flex flex-col gap-2 items-center text-center"
          >
            <FileDown className="h-6 w-6" />
            <span>Google Docs / Word</span>
            <span className="text-xs text-muted-foreground font-normal">Editable Document</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.open(`/api/export/xlsx?languageId=${languageId}`, "_blank")
            }}
            disabled={isPending}
            className="h-auto py-4 flex flex-col gap-2 items-center text-center"
          >
            <FileDown className="h-6 w-6" />
            <span>Excel Spreadsheet</span>
            <span className="text-xs text-muted-foreground font-normal">Multi-sheet Workbook</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.open(`/api/export/csv?languageId=${languageId}`, "_blank")
            }}
            disabled={isPending}
            className="h-auto py-4 flex flex-col gap-2 items-center text-center"
          >
            <FileDown className="h-6 w-6" />
            <span>CSV (Dictionary)</span>
            <span className="text-xs text-muted-foreground font-normal">Spreadsheet Compatible</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.open(`/api/export/json?languageId=${languageId}`, "_blank")
            }}
            disabled={isPending}
            className="h-auto py-4 flex flex-col gap-2 items-center text-center"
          >
            <FileDown className="h-6 w-6" />
            <span>JSON Data</span>
            <span className="text-xs text-muted-foreground font-normal">Raw Database Export</span>
          </Button>
        </div>
      </div>
    </Card>
  )
}
