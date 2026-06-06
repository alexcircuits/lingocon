"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Check, ChevronsUpDown } from "lucide-react"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { searchCollaboratorCandidates } from "@/app/actions/collaborator"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export interface User {
    id: string
    name: string | null
    image: string | null
}

interface UserSearchProps {
    languageId: string
    onSelect: (user: User) => void
    label?: string
    className?: string
}

function displayName(user: User, fallback: string): string {
    return user.name?.trim() || fallback
}

export function UserSearch({ languageId, onSelect, label, className }: UserSearchProps) {
    const t = useTranslations("userSearch")
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [users, setUsers] = React.useState<User[]>([])
    const [loading, setLoading] = React.useState(false)

    const debouncedQuery = useDebounce(query, 300)

    React.useEffect(() => {
        if (debouncedQuery.length < 2) {
            setUsers([])
            return
        }

        const fetchUsers = async () => {
            setLoading(true)
            const result = await searchCollaboratorCandidates(languageId, debouncedQuery)
            if (result.success && result.data) {
                setUsers(result.data)
            }
            setLoading(false)
        }

        fetchUsers()
    }, [debouncedQuery, languageId])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", className)}
                >
                    {label ?? t("searchPlaceholder")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 shadow-lg" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={t("searchPlaceholder")}
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList>
                        {loading && <div className="py-6 text-center text-sm text-muted-foreground">{t("searching")}</div>}
                        {!loading && users.length === 0 && query.length >= 2 && (
                            <CommandEmpty>{t("noUsers")}</CommandEmpty>
                        )}
                        {!loading && users.length === 0 && query.length < 2 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">{t("typeMore")}</div>
                        )}
                        <CommandGroup>
                            {users.map((user) => (
                                <CommandItem
                                    key={user.id}
                                    value={user.id}
                                    onSelect={() => {
                                        onSelect(user)
                                        setOpen(false)
                                        setQuery("")
                                        setUsers([])
                                    }}
                                >
                                    <div className="flex items-center gap-2 w-full overflow-hidden">
                                        <Avatar className="h-6 w-6 shrink-0">
                                            <AvatarImage src={user.image || undefined} />
                                            <AvatarFallback>{user.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-medium truncate">{displayName(user, t("unnamed"))}</span>
                                    </div>
                                    <Check
                                        className={cn(
                                            "ml-auto h-4 w-4",
                                            "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
