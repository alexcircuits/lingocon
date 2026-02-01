import { Suspense } from "react"
import { getAllUsers } from "@/app/actions/admin-analytics"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Users, Search, Languages, Activity, FileText, Download } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { Pagination } from "@/components/admin/pagination"
import { CopyButton } from "@/components/admin/copy-button"

export const dynamic = "force-dynamic"

async function UsersList({ search, page }: { search?: string; page?: number }) {
    const { users, pagination } = await getAllUsers({
        search,
        page: page || 1,
        limit: 20
    })

    if (users.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No users found</p>
                <p className="text-sm mt-1">Try adjusting your search</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* User List */}
            <div className="space-y-2">
                {users.map((user) => (
                    <div
                        key={user.id}
                        className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-border transition-colors group"
                    >
                        <Link href={`/admin/users/${user.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={user.image || undefined} />
                                <AvatarFallback>
                                    {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">{user.name}</p>
                                    {user.isAdmin && (
                                        <Badge variant="secondary" className="text-xs">
                                            Admin
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                    {user.email}
                                </p>
                            </div>
                            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <Languages className="h-4 w-4" />
                                    <span>{user.languages}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Activity className="h-4 w-4" />
                                    <span>{user.activities}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <FileText className="h-4 w-4" />
                                    <span>{user.articles}</span>
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {format(new Date(user.createdAt), "MMM d, yyyy")}
                            </div>
                        </Link>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <CopyButton value={user.id} label="ID" />
                            {user.email && <CopyButton value={user.email} label="Email" />}
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
            />
        </div>
    )
}

function LoadingSkeleton() {
    return (
        <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
        </div>
    )
}

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams: Promise<{ search?: string; page?: string }>
}) {
    const params = await searchParams
    const search = params.search || ""
    const page = params.page ? parseInt(params.page) : 1

    return (
        <div className="p-4 md:p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-serif mb-2">Users</h1>
                    <p className="text-muted-foreground">
                        Manage and view all registered users
                    </p>
                </div>
                <Button variant="outline" asChild className="gap-2">
                    <a href="/api/admin/export/users" download>
                        <Download className="h-4 w-4" />
                        Export CSV
                    </a>
                </Button>
            </div>

            {/* Search */}
            <Card className="mb-6">
                <CardContent className="pt-6">
                    <form className="flex flex-wrap gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                name="search"
                                placeholder="Search by name or email..."
                                defaultValue={search}
                                className="pl-10"
                            />
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Users List */}
            <Suspense fallback={<LoadingSkeleton />}>
                <UsersList search={search} page={page} />
            </Suspense>
        </div>
    )
}
