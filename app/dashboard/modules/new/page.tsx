import Link from "next/link"
import { redirect } from "next/navigation"
import { getUserId } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateModuleForm } from "@/components/modules/create-module-form"

export const metadata = { title: "New Module", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function NewModulePage() {
  const userId = await getUserId()
  if (!userId) redirect("/login")

  const navUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, isAdmin: true },
  })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar user={navUser} isDevMode={process.env.DEV_MODE === "true"} />
      <div className="h-14" />

      <main className="container mx-auto max-w-2xl flex-1 px-4 py-10">
        <Link
          href="/dashboard/modules"
          className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← My modules
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Create a module</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateModuleForm />
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
