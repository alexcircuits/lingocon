import { getUserId } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Globe, Languages, Plus, ArrowRight } from "lucide-react"
import { getTotalKeyCount } from "@/lib/i18n/config"
import { getTranslations } from "next-intl/server"
import enMessages from "@/messages/en.json"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Translate the site",
  robots: { index: false, follow: false },
}

export default async function TranslateUiPickerPage() {
  const t = await getTranslations("i18n")
  const userId = await getUserId()

  if (!userId && process.env.DEV_MODE !== "true") {
    redirect("/login")
  }

  const navUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true, isAdmin: true },
      })
    : null
  const isDevMode = process.env.DEV_MODE === "true"

  const userLanguages = userId
    ? await prisma.language.findMany({
        where: {
          OR: [
            { ownerId: userId },
            { collaborators: { some: { userId } } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          flagUrl: true,
          ownerId: true,
          _count: { select: { uiTranslations: true } },
        },
        orderBy: { updatedAt: "desc" },
      })
    : []

  const totalKeys = getTotalKeyCount(enMessages)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar user={navUser} isDevMode={isDevMode} />
      <div className="h-14" />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {t("pickerTitle")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("pickerSubtitle")}</p>
        </div>

        {userLanguages.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Languages className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-base font-semibold">{t("noLanguagesTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("noLanguagesDesc")}
                </p>
              </div>
              <Link href="/dashboard/new-language" className="inline-block">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("createConlang")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {userLanguages.map((lang) => {
              const translatedCount = lang._count.uiTranslations
              const percentage =
                totalKeys > 0 ? Math.round((translatedCount / totalKeys) * 100) : 0
              const isOwner = lang.ownerId === userId
              return (
                <Link
                  key={lang.id}
                  href={`/studio/lang/${lang.slug}/translate`}
                  className="block"
                >
                  <Card className="transition-all hover:border-primary/50 hover:shadow-sm">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="h-10 w-10 shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {lang.flagUrl ? (
                          <Image
                            src={lang.flagUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 object-cover"
                            unoptimized
                          />
                        ) : (
                          <Globe className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{lang.name}</span>
                          {!isOwner && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground border rounded px-1.5 py-0.5">
                              {t("collaborator")}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Progress value={percentage} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {percentage}% ({translatedCount}/{totalKeys})
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}

            <div className="pt-4">
              <Link
                href="/dashboard/new-language"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {t("createConlang")}
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
