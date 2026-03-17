"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GitBranch, X, Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { setParentLanguage, setExternalAncestry, searchParentLanguages, getExternalAncestries } from "@/app/actions/language-family"
import { LanguageFamilyTree } from "@/components/language-family-tree"
import { FamilyTreeErrorBoundary } from "@/components/family-tree-error-boundary"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

interface SearchResult {
  id: string
  name: string
  slug: string
  owner: { name: string | null }
}

interface ParentLanguageCardProps {
  languageId: string
  currentParentId: string | null
  initialParent: { id: string; name: string; owner: { name: string | null } } | null
  initialExternalAncestry: string | null
  userLanguages: { id: string; name: string; slug: string }[]
  descendantIds: string[]
  familyTree: any
  currentSlug: string
}

export function ParentLanguageCard({
  languageId,
  currentParentId,
  initialParent,
  initialExternalAncestry,
  familyTree,
  currentSlug,
}: ParentLanguageCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  // Selection State
  const [parentId, setParentId] = useState(currentParentId || "")
  const [parentName, setParentName] = useState(initialParent?.name || "")
  
  // Combobox State
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [ownLangs, setOwnLangs] = useState<SearchResult[]>([])
  const [publicLangs, setPublicLangs] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // External Ancestry State
  const [externalAncestry, setExternalAncestryState] = useState(initialExternalAncestry || "")
  const [ancestrySuggestions, setAncestrySuggestions] = useState<string[]>([])

  // Fetch autocomplete suggestions for external ancestry on mount
  useEffect(() => {
    getExternalAncestries().then(setAncestrySuggestions)
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setIsLoading(true)
      searchParentLanguages(languageId, searchQuery).then(res => {
        setOwnLangs(res.own)
        setPublicLangs(res.public)
        setIsLoading(false)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, open, languageId])

  const handleSetParent = (newParentId: string, newParentName: string) => {
    setParentId(newParentId)
    setParentName(newParentName)
    setOpen(false)
    startTransition(async () => {
      const result = await setParentLanguage(languageId, newParentId || null)
      if (result.error) {
        toast.error(result.error)
        setParentId(currentParentId || "")
        setParentName(initialParent?.name || "")
      } else {
        toast.success(newParentId ? "Parent language set!" : "Parent language removed.")
        router.refresh()
      }
    })
  }

  const handleClearParent = () => {
    handleSetParent("", "")
  }

  const handleSaveExternalAncestry = () => {
    startTransition(async () => {
      const result = await setExternalAncestry(languageId, externalAncestry)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("External ancestry updated!")
        router.refresh()
      }
    })
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Language Family
          </h3>
          <p className="text-sm text-muted-foreground">
            Connect your language to a parent on LingoCon, or declare its real-world ancestry.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>LingoCon Parent Language</Label>
            <div className="flex gap-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={isPending}
                  >
                    {parentId ? parentName : "None (root language)"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search languages..." 
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {isLoading ? (
                          <div className="py-6 text-center text-sm flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Searching...
                          </div>
                        ) : "No languages found."}
                      </CommandEmpty>
                      
                      {ownLangs.length > 0 && (
                        <CommandGroup heading="Your Languages">
                          {ownLangs.map((lang) => (
                            <CommandItem
                              key={lang.id}
                              value={lang.name}
                              onSelect={() => handleSetParent(lang.id, lang.name)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", parentId === lang.id ? "opacity-100" : "opacity-0")} />
                              {lang.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}

                      {publicLangs.length > 0 && (
                        <CommandGroup heading="Public Languages">
                          {publicLangs.map((lang) => (
                            <CommandItem
                              key={lang.id}
                              value={lang.name}
                              onSelect={() => handleSetParent(lang.id, lang.name)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", parentId === lang.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span>{lang.name}</span>
                                <span className="text-xs text-muted-foreground">by {lang.owner.name}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {parentId && (
                <Button variant="outline" size="icon" onClick={handleClearParent} disabled={isPending} title="Remove parent">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Search to link with public languages from any user.</p>
          </div>

          <div className="space-y-2">
            <Label>External Ancestry (Proto-language)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input 
                  value={externalAncestry} 
                  onChange={(e) => setExternalAncestryState(e.target.value)}
                  placeholder="e.g. Proto-Indo-European"
                  disabled={isPending}
                  list="ancestry-suggestions"
                />
                <datalist id="ancestry-suggestions">
                  {ancestrySuggestions
                    .filter(s => s !== externalAncestry)
                    .map(s => (
                      <option key={s} value={s} />
                    ))}
                </datalist>
              </div>
              <Button onClick={handleSaveExternalAncestry} disabled={isPending || externalAncestry === (initialExternalAncestry || "")}>
                Save
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">For real-world proto-languages that don&apos;t exist in LingoCon. Existing values will appear as suggestions.</p>
          </div>
        </div>

        {/* Show family tree if available */}
        {familyTree && (
          <div className="pt-4 border-t border-border/40">
            <FamilyTreeErrorBoundary>
              <LanguageFamilyTree
                tree={familyTree}
                currentSlug={currentSlug}
                linkPrefix="studio"
              />
            </FamilyTreeErrorBoundary>
          </div>
        )}
      </div>
    </Card>
  )
}
