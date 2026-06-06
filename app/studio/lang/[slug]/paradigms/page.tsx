import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { ParadigmManager } from "./paradigm-manager"

async function getLanguage(slug: string) {
  // The layout already handles access control, so we just need to fetch the language
  const language = await prisma.language.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      paradigms: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  })

  return language
}

export default async function ParadigmsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const language = await getLanguage(slug)
  const t = await getTranslations("studio.paradigms")

  if (!language) {
    return null
  }

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-border/40">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">
          {t("pageDescription")}
        </p>
      </div>

      <ParadigmManager languageId={language.id} paradigms={language.paradigms} />
    </div>
  )
}
