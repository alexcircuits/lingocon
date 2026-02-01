"use client"

import * as React from "react"
import { Check, ChevronsUpDown, User as UserIcon } from "lucide-react"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { searchUsers } from "@/app/actions/user"
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
    email: string | null
    image: string | null
}

interface UserSearchProps {
    onSelect: (user: User) => void
    label?: string
    className?: string
}

export function UserSearch({ onSelect, label = "Search user...", className }: UserSearchProps) {
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
            const result = await searchUsers(debouncedQuery)
            if (result.success && result.data) {
                setUsers(result.data)
            }
            setLoading(false)
        }

        fetchUsers()
    }, [debouncedQuery])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", className)}
                >
                    {label}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 shadow-lg" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search by name or email..."
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList>
                        {loading && <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>}
                        {!loading && users.length === 0 && query.length >= 2 && (
                            <CommandEmpty>No users found.</CommandEmpty>
                        )}
                        {!loading && users.length === 0 && query.length < 2 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">Type at least 2 characters</div>
                        )}
                        <CommandGroup>
                            {users.map((user) => (
                                <CommandItem
                                    key={user.id}
                                    value={user.id} // This is used for key handling, but onSelect is what matters
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
                                        <div className="flex flex-col truncate">
                                            <span className="text-sm font-medium truncate">{user.name || "Unknown"}</span>
                                            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                                        </div>
                                    </div>
                                    <Check
                                        className={cn(
                                            "ml-auto h-4 w-4",
                                            "opacity-0" // Always hidden as we don't persist selection in the list
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
