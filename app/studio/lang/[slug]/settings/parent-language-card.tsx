"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GitBranch, X } from "lucide-react"
import { setParentLanguage } from "@/app/actions/language-family"
import { LanguageFamilyTree } from "@/components/language-family-tree"

interface ParentLanguageCardProps {
  languageId: string
  currentParentId: string | null
  userLanguages: { id: string; name: string; slug: string }[]
  familyTree: any
  currentSlug: string
}

export function ParentLanguageCard({
  languageId,
  currentParentId,
  userLanguages,
  familyTree,
  currentSlug,
}: ParentLanguageCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [parentId, setParentId] = useState(currentParentId || "")

  const handleSetParent = (newParentId: string) => {
    setParentId(newParentId)
    startTransition(async () => {
      const result = await setParentLanguage(
        languageId,
        newParentId || null
      )
      if (result.error) {
        toast.error(result.error)
        setParentId(currentParentId || "")
      } else {
        toast.success(
          newParentId
            ? "Parent language set!"
            : "Parent language removed."
        )
        router.refresh()
      }
    })
  }

  const handleClearParent = () => {
    handleSetParent("")
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Language Family
          </h3>
          <p className="text-sm text-muted-foreground">
            Set a parent language to create family tree relationships (e.g., Proto-Lang → Daughter Lang).
          </p>
        </div>

        <div className="space-y-2">
          <Label>Parent Language</Label>
          <div className="flex gap-2">
            <Select
              value={parentId}
              onValueChange={handleSetParent}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="None (this is a root/proto language)" />
              </SelectTrigger>
              <SelectContent>
                {userLanguages.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {parentId && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleClearParent}
                disabled={isPending}
                title="Remove parent"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Leave empty if this is a proto-language or has no parent in your language family.
          </p>
        </div>

        {/* Show family tree if available */}
        {familyTree && (
          <div className="pt-4 border-t border-border/40">
            <LanguageFamilyTree
              tree={familyTree}
              currentSlug={currentSlug}
              linkPrefix="studio"
            />
          </div>
        )}
      </div>
    </Card>
  )
}
