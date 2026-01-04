import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function DictionaryTableSkeleton() {
  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary/30">
            <tr>
              <th className="w-12 p-3 text-left">
                <Skeleton className="h-4 w-4" />
              </th>
              <th className="p-3 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
              <th className="p-3 text-left">
                <Skeleton className="h-4 w-24" />
              </th>
              <th className="p-3 text-left">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="p-3 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
              <th className="w-32 p-3 text-right">
                <Skeleton className="h-4 w-16 ml-auto" />
              </th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className="p-3">
                  <Skeleton className="h-4 w-4 mx-auto" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-4 w-32" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-4 w-48" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-4 w-20" />
                </td>
                <td className="p-3">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function LanguageCardSkeleton() {
  return (
    <Card className="border-border/40 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton className="h-10 w-14 rounded-md shrink-0" />
            <div className="space-y-2 min-w-0 flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full mt-3" />
        <Skeleton className="h-4 w-3/4 mt-2" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex flex-col items-center p-2 rounded-lg bg-secondary/30">
              <Skeleton className="h-4 w-4 mb-1" />
              <Skeleton className="h-3 w-8 mb-1" />
              <Skeleton className="h-2 w-12" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function AlphabetGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {[...Array(12)].map((_, i) => (
        <Card key={i} className="relative">
          <CardContent className="p-4 flex flex-col items-center justify-center min-h-[140px]">
            <Skeleton className="h-12 w-12 rounded mb-3" />
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-3 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function GrammarPageSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  )
}

export function ActivityFeedSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

