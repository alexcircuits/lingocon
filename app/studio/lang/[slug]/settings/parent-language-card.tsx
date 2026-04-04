"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GitBranch, X, Check, ChevronsUpDown, Loader2, Plus, FolderTree, ChevronRight } from "lucide-react"
import { setParentLanguage, setLanguageFamily, createFamily, searchFamilies, searchParentLanguages, getFamilyAncestryPath, getFamilyChildren } from "@/app/actions/language-family"
import { LanguageFamilyTree } from "@/components/language-family-tree"
import { FamilyTreeErrorBoundary } from "@/components/family-tree-error-boundary"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { cn } from "@/lib/utils"

interface SearchResult {
  id: string
  name: string
  slug: string
  owner: { name: string | null }
}

interface FamilyResult {
  id: string
  name: string
  slug: string
  description: string | null
  type?: string
  owner?: { name: string | null }
  _count: { languages: number }
}

interface ParentLanguageCardProps {
  languageId: string
  currentParentId: string | null
  initialParent: { id: string; name: string; owner: { name: string | null } } | null
  initialExternalAncestry: string | null
  initialFamilyId: string | null
  initialFamily: { id: string; name: string; description: string | null } | null
  families: { id: string; name: string; slug: string; description: string | null; visibility: string; _count: { languages: number } }[]
  userLanguages: { id: string; name: string; slug: string }[]
  descendantIds: string[]
  familyTree: any
  currentSlug: string
  isOwner?: boolean
}

export function ParentLanguageCard({
  languageId,
  currentParentId,
  initialParent,
  initialFamilyId,
  initialFamily,
  familyTree,
  currentSlug,
  isOwner = true,
}: ParentLanguageCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Parent Selection State
  const [parentId, setParentId] = useState(currentParentId || "")
  const [parentName, setParentName] = useState(initialParent?.name || "")

  // Parent Combobox State
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [ownLangs, setOwnLangs] = useState<SearchResult[]>([])
  const [publicLangs, setPublicLangs] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Unified Family State
  const [familyId, setFamilyIdState] = useState(initialFamilyId || "")
  const [familyName, setFamilyNameState] = useState(initialFamily?.name || "")
  const [familyOpen, setFamilyOpen] = useState(false)
  const [familySearch, setFamilySearch] = useState("")
  const [systemFamilies, setSystemFamilies] = useState<FamilyResult[]>([])
  const [ownFamilies, setOwnFamilies] = useState<FamilyResult[]>([])
  const [publicFamilies, setPublicFamilies] = useState<FamilyResult[]>([])
  const [isFamilyLoading, setIsFamilyLoading] = useState(false)
  const [showNewFamily, setShowNewFamily] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState("")

  // Ancestry breadcrumb state
  const [ancestryPath, setAncestryPath] = useState<{ id: string; name: string; slug: string }[]>([])
  const [childFamilies, setChildFamilies] = useState<{ id: string; name: string; slug: string; _count: { languages: number; childFamilies: number } }[]>([])
  const [showSubFamilies, setShowSubFamilies] = useState(false)

  // Parent language search
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

  // Family search (unified: system + own + public)
  useEffect(() => {
    if (!familyOpen) return
    const timer = setTimeout(() => {
      setIsFamilyLoading(true)
      searchFamilies(familySearch).then(res => {
        setSystemFamilies(res.system as FamilyResult[])
        setOwnFamilies(res.own as FamilyResult[])
        setPublicFamilies(res.public as FamilyResult[])
        setIsFamilyLoading(false)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [familySearch, familyOpen])

  // Fetch ancestry path and children when family is selected
  useEffect(() => {
    if (!familyId) {
      setAncestryPath([])
      setChildFamilies([])
      return
    }
    getFamilyAncestryPath(familyId).then(setAncestryPath)
    getFamilyChildren(familyId).then((children) => {
      setChildFamilies(children as any)
      setShowSubFamilies(children.length > 0)
    })
  }, [familyId])

  const handleSetParent = (newParentId: string, newParentName: string) => {
    setParentId(newParentId)
    setParentName(newParentName)
    setOpen(false)
    startTransition(async () => {
      const result = await setParentLanguage(languageId, newParentId || null)
      if ('error' in result) {
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

  const handleSetFamily = (newFamilyId: string, newFamilyName: string) => {
    setFamilyIdState(newFamilyId)
    setFamilyNameState(newFamilyName)
    setFamilyOpen(false)
    startTransition(async () => {
      const result = await setLanguageFamily(languageId, newFamilyId || null)
      if ('error' in result) {
        toast.error(result.error)
        setFamilyIdState(initialFamilyId || "")
        setFamilyNameState(initialFamily?.name || "")
      } else {
        toast.success(newFamilyId ? "Language family set!" : "Removed from family.")
        router.refresh()
      }
    })
  }

  const handleClearFamily = () => {
    handleSetFamily("", "")
  }

  const handleCreateFamily = () => {
    if (!newFamilyName.trim()) return
    startTransition(async () => {
      const result = await createFamily({ name: newFamilyName.trim() })
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Family "${result.family.name}" created!`)
        handleSetFamily(result.family.id, result.family.name)
        setNewFamilyName("")
        setShowNewFamily(false)
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
            Group your language into a family and connect it to a parent language.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Unified Family Selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5" />
              Language Family
            </Label>
            <div className="flex gap-2">
              <Popover open={familyOpen} onOpenChange={setFamilyOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={familyOpen}
                    className="w-full justify-between"
                    disabled={isPending || !isOwner}
                  >
                    {familyId ? familyName : "None (independent)"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search families..."
                      value={familySearch}
                      onValueChange={setFamilySearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {isFamilyLoading ? (
                          <div className="py-6 text-center text-sm flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Searching...
                          </div>
                        ) : "No families found."}
                      </CommandEmpty>

                      {systemFamilies.length > 0 && (
                        <CommandGroup heading="Real-World Families">
                          {systemFamilies.map((fam) => (
                            <CommandItem
                              key={fam.id}
                              value={fam.name}
                              onSelect={() => handleSetFamily(fam.id, fam.name)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", familyId === fam.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span>{fam.name}</span>
                                <span className="text-xs text-muted-foreground">{fam._count.languages} language{fam._count.languages !== 1 ? "s" : ""}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}

                      {ownFamilies.length > 0 && (
                        <>
                          {systemFamilies.length > 0 && <CommandSeparator />}
                          <CommandGroup heading="Your Families">
                            {ownFamilies.map((fam) => (
                              <CommandItem
                                key={fam.id}
                                value={fam.name}
                                onSelect={() => handleSetFamily(fam.id, fam.name)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", familyId === fam.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span>{fam.name}</span>
                                  <span className="text-xs text-muted-foreground">{fam._count.languages} language{fam._count.languages !== 1 ? "s" : ""}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      )}

                      {publicFamilies.length > 0 && (
                        <>
                          <CommandSeparator />
                          <CommandGroup heading="Public Families">
                            {publicFamilies.map((fam) => (
                              <CommandItem
                                key={fam.id}
                                value={fam.name}
                                onSelect={() => handleSetFamily(fam.id, fam.name)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", familyId === fam.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span>{fam.name}</span>
                                  <span className="text-xs text-muted-foreground">by {fam.owner?.name} · {fam._count.languages} lang{fam._count.languages !== 1 ? "s" : ""}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      )}

                      <CommandSeparator />
                      <CommandGroup>
                        <CommandItem onSelect={() => { setFamilyOpen(false); setShowNewFamily(true) }}>
                          <Plus className="mr-2 h-4 w-4" />
                          Create New Family
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {familyId && (
                <Button variant="outline" size="icon" onClick={handleClearFamily} disabled={isPending} title="Remove from family">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Choose a real-world proto-language, your own family, or a public one.</p>

            {/* Inline create family */}
            {showNewFamily && (
              <div className="flex gap-2 mt-2">
                <Input
                  value={newFamilyName}
                  onChange={e => setNewFamilyName(e.target.value)}
                  placeholder="Family name..."
                  className="flex-1"
                  onKeyDown={e => e.key === "Enter" && handleCreateFamily()}
                />
                <Button onClick={handleCreateFamily} disabled={isPending || !newFamilyName.trim()} size="sm">
                  Create
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowNewFamily(false); setNewFamilyName("") }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Ancestry breadcrumb + sub-family drill-down */}
            {familyId && ancestryPath.length > 0 && (
              <div className="mt-3 space-y-2">
                {/* Breadcrumb path */}
                <div className="flex items-center gap-0.5 flex-wrap text-xs">
                  {ancestryPath.map((node, i) => (
                    <span key={node.id} className="flex items-center gap-0.5">
                      {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      <button
                        onClick={() => {
                          if (node.id !== familyId) {
                            handleSetFamily(node.id, node.name)
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded transition-colors ${
                          node.id === familyId
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        }`}
                      >
                        {node.name.replace("Proto-", "P-")}
                      </button>
                    </span>
                  ))}
                </div>

                {/* Child sub-families */}
                {showSubFamilies && childFamilies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground py-1">Sub-families:</span>
                    {childFamilies.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => handleSetFamily(child.id, child.name)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-secondary/50 hover:bg-secondary transition-colors text-foreground"
                      >
                        {child.name}
                        {child._count.childFamilies > 0 && (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Parent Language Selector */}
          <div className="space-y-2">
            <Label>Parent Language</Label>
            <div className="flex gap-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={isPending || !isOwner}
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
