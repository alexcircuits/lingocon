"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ShieldAlert, Search } from "lucide-react"
import { format } from "date-fns"
import { Pagination } from "@/components/admin/pagination"
import { getAuditLogs } from "@/app/actions/admin-audit"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useRouter, useSearchParams } from "next/navigation"

export const dynamic = "force-dynamic"

interface AuditLogPageProps {
    searchParams: {
        page?: string
        action?: string
        resource?: string
    }
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
    const page = Number(searchParams.page) || 1
    const { logs, pagination } = await getAuditLogs({
        page,
        limit: 20,
        action: searchParams.action,
        resource: searchParams.resource
    })

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-serif mb-2">Audit Logs</h1>
                <p className="text-muted-foreground">
                    Track administrative actions and system events
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-medium flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-primary" />
                            Activity Log
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date & Time</TableHead>
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
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-muted-foreground whitespace-nowrap">
                                            {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
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
                                            <Badge variant="outline" className="font-mono">
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-xs">
                                                    {log.resource}
                                                </span>
                                                {log.resourceId && (
                                                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[100px]">
                                                        {log.resourceId}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <pre className="text-xs text-muted-foreground max-w-[300px] overflow-x-auto p-2 bg-muted/50 rounded-md">
                                                {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    <div className="mt-4">
                        <Pagination
                            currentPage={page}
                            totalPages={pagination.pages}
                            totalItems={pagination.total}
                            itemsPerPage={20}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
