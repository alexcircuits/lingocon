"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

interface DictionaryPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function DictionaryPagination({
  currentPage,
  totalPages,
  onPageChange,
}: DictionaryPaginationProps) {
  const [jumpPage, setJumpPage] = useState("")
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false)

  if (totalPages <= 1) return null

  const handleJumpToPage = () => {
    const page = parseInt(jumpPage, 10)
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
      setJumpPage("")
      setJumpDialogOpen(false)
    }
  }

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = new Set<number>([1, totalPages])
    pages.add(currentPage)
    if (currentPage > 1) pages.add(currentPage - 1)
    if (currentPage < totalPages) pages.add(currentPage + 1)
    
    return Array.from(pages).sort((a, b) => a - b)
  }

  const pages = getPageNumbers()

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        
        <div className="flex items-center gap-1">
          {pages.map((page, index) => {
            const prevPage = pages[index - 1]
            const showEllipsis = prevPage && page - prevPage > 1

            return (
              <div key={page} className="flex items-center">
                {showEllipsis && (
                  <Dialog open={jumpDialogOpen} onOpenChange={setJumpDialogOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Jump to Page</DialogTitle>
                        <DialogDescription>
                          Enter a page number between 1 and {totalPages}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex items-center gap-2 py-4">
                        <Input
                          type="number"
                          min={1}
                          max={totalPages}
                          value={jumpPage}
                          onChange={(e) => setJumpPage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleJumpToPage()
                            }
                          }}
                          placeholder="Page number"
                          className="flex-1"
                        />
                        <Button type="button" onClick={handleJumpToPage}>Go</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                <Button
                  type="button"
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className={cn(
                    "min-w-[2.5rem]",
                    currentPage === page && "font-semibold"
                  )}
                >
                  {page}
                </Button>
              </div>
            )
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="gap-1"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

