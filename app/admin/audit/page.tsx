import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ShieldAlert } from "lucide-react"
import { format } from "date-fns"
import { Pagination } from "@/components/admin/pagination"
import { getAuditLogs, getAuditFilterOptions } from "@/app/actions/admin-audit"
import { AuditFilters } from "@/components/admin/audit-filters"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

const LIMIT = 20

function formatDetails(details: unknown): string | null {
    if (details === null || details === undefined) return null
    if (typeof details !== "object") return String(details)
    const entries = Object.entries(details as Record<string, unknown>)
    if (entries.length === 0) return null
    return entries
        .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
        .join("  ·  ")
}

export default async function AuditLogPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; action?: string; resource?: string }>
}) {
    const params = await searchParams
    const page = Number(params.page) || 1

    const [{ logs, pagination }, filterOptions] = await Promise.all([
        getAuditLogs({
            page,
            limit: LIMIT,
            action: params.action,
            resource: params.resource,
        }),
        getAuditFilterOptions(),
    ])

    return (
        <div className="p-4 md:p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-serif mb-2">Audit Logs</h1>
                <p className="text-muted-foreground">
                    Track administrative actions and system events
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <CardTitle className="text-lg font-medium flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-primary" />
                            Activity Log
                            <span className="ml-1 text-sm font-normal text-muted-foreground">
                                ({pagination.total.toLocaleString()})
                            </span>
                        </CardTitle>
                        <AuditFilters
                            actions={filterOptions.actions}
                            resources={filterOptions.resources}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Date &amp; Time</TableHead>
                                    <TableHead>Admin</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Resource</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="h-24 text-center text-muted-foreground"
                                        >
                                            No audit logs found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => {
                                        const details = formatDetails(log.details)
                                        return (
                                            <TableRow key={log.id}>
                                                <TableCell className="text-muted-foreground whitespace-nowrap">
                                                    {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">
                                                            {log.admin.name || "Unknown"}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {log.admin.email}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        {log.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-medium">
                                                            {log.resource}
                                                        </span>
                                                        {log.resourceId && (
                                                            <span className="max-w-[120px] truncate font-mono text-xs text-muted-foreground">
                                                                {log.resourceId}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[320px]">
                                                    {details ? (
                                                        <span className="text-xs text-muted-foreground">
                                                            {details}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/50">—</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-4">
                        <Pagination
                            currentPage={page}
                            totalPages={pagination.pages}
                            totalItems={pagination.total}
                            itemsPerPage={LIMIT}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
