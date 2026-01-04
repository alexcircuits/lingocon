"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function WizardEntry() {
  const router = useRouter()

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
        <Button
          onClick={() => router.push("/dashboard/new-language?wizard=true")}
          className="w-full"
        >
          Use Guided Setup
        </Button>
      </CardContent>
    </Card>
  )
}

