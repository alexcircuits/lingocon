"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
}

export function Pagination({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage
}: PaginationProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const createPageUrl = (page: number) => {
        const params = new URLSearchParams(searchParams)
        params.set("page", page.toString())
        return `${pathname}?${params.toString()}`
    }

    const startItem = (currentPage - 1) * itemsPerPage + 1
    const endItem = Math.min(currentPage * itemsPerPage, totalItems)

    if (totalPages <= 1) {
        return (
            <div className="text-sm text-muted-foreground">
                Showing {totalItems} item{totalItems !== 1 ? "s" : ""}
            </div>
        )
    }

    return (
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
                Showing {startItem}–{endItem} of {totalItems}
            </p>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    asChild={currentPage > 1}
                >
                    {currentPage > 1 ? (
                        <Link href={createPageUrl(currentPage - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Link>
                    ) : (
                        <>
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </>
                    )}
                </Button>

                <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                            pageNum = i + 1
                        } else if (currentPage <= 3) {
                            pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                        } else {
                            pageNum = currentPage - 2 + i
                        }

                        return (
                            <Button
                                key={pageNum}
                                variant={pageNum === currentPage ? "default" : "outline"}
                                size="sm"
                                className="w-9"
                                asChild={pageNum !== currentPage}
                            >
                                {pageNum !== currentPage ? (
                                    <Link href={createPageUrl(pageNum)}>{pageNum}</Link>
                                ) : (
                                    <span>{pageNum}</span>
                                )}
                            </Button>
                        )
                    })}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    asChild={currentPage < totalPages}
                >
                    {currentPage < totalPages ? (
                        <Link href={createPageUrl(currentPage + 1)}>
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Link>
                    ) : (
                        <>
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
