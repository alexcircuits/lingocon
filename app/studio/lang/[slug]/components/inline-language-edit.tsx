"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateLanguage } from "@/app/actions/language"
import { InlineEdit } from "@/components/ui/inline-edit"
import { commonRules } from "@/lib/hooks/use-form-validation"
import { useStudioAccess } from "@/components/studio-access"

interface InlineLanguageEditProps {
  languageId: string
  field: "name" | "description"
  value: string
  maxLength?: number
  /** Visible field label, reused as the accessible name of the editor. */
  label?: string
}

export function InlineLanguageEdit({
  languageId,
  field,
  value,
  maxLength,
  label,
}: InlineLanguageEditProps) {
  const t = useTranslations("inlineLanguageEdit")
  const router = useRouter()
  // Renaming or describing the project is a settings change (updateLanguage needs write:settings);
  // anyone else sees the plain value, without the edit affordance.
  const canEdit = useStudioAccess().canWrite("write:settings")
  const [isPending, startTransition] = useTransition()

  // Show a saved value immediately (the prop is stale until the refresh lands); follow the server
  // whenever it sends a different value.
  const [displayValue, setDisplayValue] = useState(value)
  const [serverValue, setServerValue] = useState(value)
  if (value !== serverValue) {
    setServerValue(value)
    setDisplayValue(value)
  }

  // Await the action and throw on failure so InlineEdit keeps the editor open with the typed text
  // and shows the error. (Running it inside startTransition returned immediately: the editor closed,
  // the input was discarded and the thrown error became an unhandled rejection.)
  const handleSave = async (newValue: string) => {
    let result: Awaited<ReturnType<typeof updateLanguage>>
    try {
      result = await updateLanguage({
        id: languageId,
        [field]: newValue,
      })
    } catch {
      // Network failure or a server crash: a readable message, never the raw exception.
      toast.error(t("saveFailed"))
      throw new Error(t("saveFailed"))
    }

    if ('error' in result) {
      const message = result.error || t("saveFailed")
      toast.error(message)
      throw new Error(message)
    }
    setDisplayValue(newValue)
    toast.success(field === "name" ? t("nameUpdated") : t("descriptionUpdated"))
    startTransition(() => router.refresh())
  }

  const validate = (val: string) => {
    if (field === "name") {
      if (!val.trim()) {
        return t("nameRequired")
      }
      if (val.length > 100) {
        return t("nameTooLong")
      }
    }
    if (field === "description" && val.length > 1000) {
      return t("descriptionTooLong")
    }
    return null
  }

  return (
    <InlineEdit
      value={displayValue}
      onSave={handleSave}
      // A read-only empty value shows a dash, not an invitation to "Add a description...".
      placeholder={!canEdit ? "—" : field === "name" ? t("namePlaceholder") : t("descriptionPlaceholder")}
      maxLength={maxLength}
      validate={validate}
      disabled={isPending || !canEdit}
      label={label}
      multiline={field === "description"}
    />
  )
}
