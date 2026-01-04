import { getUserId } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/card"
import { CreateLanguageForm } from "./form"
import { LanguageWizard } from "./wizard"
import { WizardEntry } from "./wizard-entry"

export const dynamic = "force-dynamic"

export default async function NewLanguagePage({
  searchParams,
}: {
  searchParams: { wizard?: string }
}) {
  const userId = await getUserId()

  // In dev mode, allow access without auth
  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const useWizard = searchParams.wizard === "true"

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Language</h1>
        <p className="mt-2 text-muted-foreground">
          Start documenting your constructed language
        </p>
      </div>

      {useWizard ? (
        <LanguageWizard />
      ) : (
        <Card className="p-6">
          <WizardEntry />
          <div className="mt-6 pt-6 border-t">
            <CreateLanguageForm />
          </div>
        </Card>
      )}
    </div>
  )
}

