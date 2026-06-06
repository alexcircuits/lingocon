import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { canEditLanguage } from "@/lib/auth-helpers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GraduationCap, Plus, ListChecks, Users, Eye, EyeOff, Archive } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { getTranslations } from "next-intl/server"
import { CreateCourseDialog } from "./create-course-dialog"

export const dynamic = "force-dynamic"

async function getStudioCourseData(slug: string, userId: string) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, ownerId: true },
  })
  if (!language) return null

  const canEdit = await canEditLanguage(language.id, userId)
  if (!canEdit) return null

  const courses = await prisma.course.findMany({
    where: { languageId: language.id },
    include: {
      author: { select: { id: true, name: true, image: true } },
      _count: { select: { lessons: true, enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return { language, courses }
}

export default async function StudioCoursesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"
  if (!session?.user?.id && !isDevMode) redirect("/login")

  const userId = session?.user?.id || (await getDevUserId())
  const data = await getStudioCourseData(slug, userId)
  if (!data) notFound()

  const t = await getTranslations("studio.courses")

  const { language, courses } = data

  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  } : null

  const visibilityIcon = (v: string) =>
    v === "PUBLISHED" ? <Eye className="h-3 w-3" />
    : v === "ARCHIVED" ? <Archive className="h-3 w-3" />
    : <EyeOff className="h-3 w-3" />

  const visibilityColor = (v: string) =>
    v === "PUBLISHED" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : v === "ARCHIVED" ? "bg-secondary text-muted-foreground"
    : "bg-amber-500/10 text-amber-600"

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar user={user} isDevMode={isDevMode} />
      <div className="h-14" />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href={`/studio/lang/${slug}`} className="text-sm text-muted-foreground hover:text-foreground">
                {language.name}
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">{t("breadcrumb")}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              {t("manageCourses")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("subtitle")}
            </p>
          </div>
          <CreateCourseDialog languageId={language.id} slug={slug} />
        </div>

        {/* Stats row */}
        <div className="mb-6 flex flex-wrap gap-4">
          <StatPill label={t("totalCourses")} value={courses.length} />
          <StatPill label={t("published")} value={courses.filter(c => c.visibility === "PUBLISHED").length} />
          <StatPill
            label={t("totalLearners")}
            value={courses.reduce((s, c) => s + c._count.enrollments, 0)}
          />
        </div>

        {/* Course list */}
        {courses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t("emptyTitle")}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                {t("emptyDesc")}
              </p>
              <CreateCourseDialog languageId={language.id} slug={slug} />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {courses.map(course => (
              <Card key={course.id} className="group hover:shadow-sm transition-all">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{course.title}</span>
                      <Badge
                        variant="secondary"
                        className={`gap-1 text-xs ${visibilityColor(course.visibility)}`}
                      >
                        {visibilityIcon(course.visibility)}
                        {course.visibility.toLowerCase()}
                      </Badge>
                    </div>
                    {course.description && (
                      <p className="text-sm text-muted-foreground truncate">{course.description}</p>
                    )}
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ListChecks className="h-3 w-3" />
                        {t("lessons", { count: course._count.lessons })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {t("learners", { count: course._count.enrollments })}
                      </span>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={`/studio/lang/${slug}/courses/${course.id}`}>
                      {t("edit")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border border-border/60 bg-card px-4 py-2 text-sm flex items-center gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}
