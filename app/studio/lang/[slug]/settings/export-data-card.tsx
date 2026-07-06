"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FileDown } from "lucide-react"

interface ExportDataCardProps {
  languageId: string
  isPending: boolean
}

export function ExportDataCard({ languageId, isPending }: ExportDataCardProps) {
  const t = useTranslations("studio.settings")
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">{t("exportData")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("exportDesc")}
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
            <span>{t("exportDocx")}</span>
            <span className="text-xs text-muted-foreground font-normal">{t("exportDocxDesc")}</span>
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
            <span>{t("exportXlsx")}</span>
            <span className="text-xs text-muted-foreground font-normal">{t("exportXlsxDesc")}</span>
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
            <span>{t("exportCsv")}</span>
            <span className="text-xs text-muted-foreground font-normal">{t("exportCsvDesc")}</span>
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
            <span>{t("exportJson")}</span>
            <span className="text-xs text-muted-foreground font-normal">{t("exportJsonDesc")}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.open(`/api/export/deck/${languageId}`, "_blank")
            }}
            disabled={isPending}
            className="h-auto py-4 flex flex-col gap-2 items-center text-center"
          >
            <FileDown className="h-6 w-6" />
            <span>{t("exportAnki")}</span>
            <span className="text-xs text-muted-foreground font-normal">{t("exportAnkiDesc")}</span>
          </Button>
        </div>
      </div>
    </Card>
  )
}
