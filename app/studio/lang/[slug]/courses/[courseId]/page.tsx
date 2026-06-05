import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
import { canEditLanguage } from "@/lib/auth-helpers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, GraduationCap, Plus, ListChecks, BookOpen, Settings } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CourseEditor } from "./course-editor"

export const dynamic = "force-dynamic"

async function getCourseEditorData(slug: string, courseId: string, userId: string) {
  const language = await prisma.language.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  })
  if (!language) return null

  const canEdit = await canEditLanguage(language.id, userId)
  if (!canEdit) return null

  const course = await prisma.course.findFirst({
    where: { id: courseId, languageId: language.id },
    include: {
      units: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, description: true, order: true },
      },
      lessons: {
        orderBy: { order: "asc" },
        include: {
          items: {
            orderBy: { order: "asc" },
            include: {
              dictEntry:   { select: { id: true, lemma: true, gloss: true, partOfSpeech: true } },
              grammarPage: { select: { id: true, title: true } },
              text:        { select: { id: true, title: true } },
              sentence:    { select: { id: true, sentence: true, translation: true } },
            },
          },
        },
      },
    },
  })
  if (!course) return null

  const grammarPages = await prisma.grammarPage.findMany({
    where: { languageId: language.id },
    select: { id: true, title: true },
    orderBy: { order: "asc" },
  })

  const texts = await prisma.text.findMany({
    where: { languageId: language.id, published: true },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  })

  return { language, course, grammarPages, texts }
}

export default async function CourseEditorPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>
}) {
  const { slug, courseId } = await params
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"
  if (!session?.user?.id && !isDevMode) redirect("/login")

  const userId = session?.user?.id || (await getDevUserId())
  const data = await getCourseEditorData(slug, courseId, userId)
  if (!data) notFound()

  const { language, course, grammarPages, texts } = data

  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  } : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar user={user} isDevMode={isDevMode} />
      <div className="h-14" />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground -ml-2">
            <Link href={`/studio/lang/${slug}/courses`}>
              <ArrowLeft className="h-4 w-4" />
              Courses
            </Link>
          </Button>
        </div>

        <CourseEditor
          course={course}
          language={language}
          grammarPages={grammarPages}
          texts={texts}
          slug={slug}
        />
      </main>
      <Footer />
    </div>
  )
}
