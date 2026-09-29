"use client"

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { useEffect, useRef, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DictionarySearchProps {
  onSearch: (query: string, field?: string) => void
  defaultValue?: string
  defaultField?: string
}

export function DictionarySearch({
  onSearch,
  defaultValue = "",
  defaultField = "all"
}: DictionarySearchProps) {
  const t = useTranslations("studio.dictionary")
  const [value, setValue] = useState(defaultValue)
  const [field, setField] = useState(defaultField)
  const debouncedValue = useDebounce(value, 300)

  // Submit when the debounced query or the field differs from what was last submitted. Comparing
  // against the last submission (not the initial props) means clearing the box back to "" still
  // resets the results, and a new `onSearch` identity after navigation does not resubmit.
  const lastSubmitted = useRef({ query: defaultValue, field: defaultField })
  useEffect(() => {
    const last = lastSubmitted.current
    if (debouncedValue === last.query && field === last.field) return
    lastSubmitted.current = { query: debouncedValue, field }

    // If field is "all", we pass undefined to the backend to search all fields
    onSearch(debouncedValue, field === "all" ? undefined : field)
  }, [debouncedValue, field, onSearch])

  const handleFieldChange = (newField: string) => {
    setField(newField)
    // No need to call onSearch here, the useEffect will trigger
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={field === "gloss" ? t("searchMeaningsPh") : field === "tags" ? t("searchByTagPh") : t("searchDictPh")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={field} onValueChange={handleFieldChange}>
        <SelectTrigger className="w-full sm:w-[130px]">
          <SelectValue placeholder={t("fieldLabel")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("fieldAll")}</SelectItem>
          <SelectItem value="lemma">{t("fieldWord")}</SelectItem>
          <SelectItem value="gloss">{t("fieldMeaning")}</SelectItem>
          <SelectItem value="partOfSpeech">{t("fieldPos")}</SelectItem>
          <SelectItem value="tags">{t("fieldTags")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
