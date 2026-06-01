import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen } from "lucide-react"
import { ModulePlayground } from "@/components/modules/module-playground"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Module Playground — LingoCon",
}

export default async function ModulePlaygroundPage() {
  const userId = await getUserId()
  if (!userId) redirect("/login")

  const languages = await prisma.language.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 md:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/modules"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            My modules
          </Link>
          <h1 className="font-serif text-2xl tracking-tight md:text-3xl">Module Playground</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Write a sandboxed widget and run it live against one of your languages — no publishing
            required. The code runs in the same locked-down sandbox used in production.
          </p>
        </div>
        <Link href="/modules/docs">
          <Button variant="outline" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Developer docs
          </Button>
        </Link>
      </div>

      {languages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            You need at least one language to test against.{" "}
            <Link href="/studio" className="text-primary hover:underline">
              Create a language
            </Link>{" "}
            first.
          </p>
        </div>
      ) : (
        <ModulePlayground languages={languages} />
      )}
    </div>
  )
}
