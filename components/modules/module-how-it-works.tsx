import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, FlaskConical, Globe, PanelsTopLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Explains the add → run → public loop for language owners. */
export function ModuleHowItWorks({ languageSlug }: { languageSlug: string }) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-4 p-5">
        <p className="text-sm font-medium">How modules work on this language</p>
        <ol className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <li className="flex gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              1
            </span>
            <span>
              <strong className="text-foreground">Add</strong> from the catalog (below or{" "}
              <Link href="/modules" className="text-primary hover:underline">
                browse all
              </Link>
              ). Choose &quot;Add to this language&quot; so it applies here.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              2
            </span>
            <span>
              <PanelsTopLeft className="mr-1 inline h-3.5 w-3.5" />
              <strong className="text-foreground">Open</strong> from the studio sidebar (Modules
              section) to use tools like transforms or charts.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              3
            </span>
            <span>
              <Globe className="mr-1 inline h-3.5 w-3.5" />
              <strong className="text-foreground">Public</strong> — reader widgets &amp; themes show
              on{" "}
              <Link href={`/lang/${languageSlug}`} className="text-primary hover:underline">
                your public page
              </Link>{" "}
              for every visitor.
            </span>
          </li>
        </ol>
        <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
          <Link href="/modules/docs">
            <Button variant="outline" size="sm" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Developer docs
            </Button>
          </Link>
          <Link href="/dashboard/modules/playground">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              Build in playground
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
