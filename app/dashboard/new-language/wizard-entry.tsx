import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function WizardEntry() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Guided Setup</CardTitle>
        <CardDescription>
          Use the guided wizard to set up your language step by step, or skip to create an empty
          language.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* A link, not a router.push button: it works before the page's JavaScript has loaded. */}
        <Button asChild className="w-full">
          <Link href="/dashboard/new-language?wizard=true">Use Guided Setup</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
