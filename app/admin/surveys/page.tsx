import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getAllSurveysForAdmin, getSurveyResults } from "@/app/actions/survey"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, Users, MessageSquare, BarChart3 } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

type SurveyResultItem = {
    questionId: string
    questionText: string
    type: string
    textResponses?: string[]
    counts?: Record<string, number>
    totalAnswered?: number
}

type SurveyResultData = {
    survey: {
        id: string
        title: string
        slug: string
        description: string | null
        isActive: boolean
        totalResponses: number
    }
    results: SurveyResultItem[]
}

async function isAdmin() {
    const session = await auth()
    if (!session?.user?.id) return false
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true },
    })
    return user?.isAdmin === true
}

export default async function AdminSurveysPage() {
    const admin = await isAdmin()
    if (!admin) redirect("/")

    const surveys = await getAllSurveysForAdmin()

    // Get detailed results for each survey
    const surveyResults = await Promise.all(
        surveys.map((s: { id: string }) => getSurveyResults(s.id))
    )

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif font-medium tracking-tight mb-2">Survey Results</h1>
                <p className="text-muted-foreground">View anonymous survey responses from the community.</p>
            </div>

            {surveys.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <ClipboardList className="h-12 w-12 mb-4 opacity-40" />
                        <p>No surveys created yet.</p>
                    </CardContent>
                </Card>
            ) : (
                surveys.map((survey: typeof surveys[number], i: number) => {
                    const results = surveyResults[i] as SurveyResultData | null
                    if (!results) return null

                    return (
                        <Card key={survey.id} className="overflow-hidden">
                            <CardHeader className="border-b bg-muted/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl font-serif flex items-center gap-3">
                                            {survey.title}
                                            <Badge variant={survey.isActive ? "default" : "secondary"}>
                                                {survey.isActive ? "Active" : "Closed"}
                                            </Badge>
                                        </CardTitle>
                                        {survey.description && (
                                            <CardDescription className="mt-1">{survey.description}</CardDescription>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Users className="h-4 w-4" />
                                        <span className="font-medium">{results.survey.totalResponses}</span> responses
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-8">
                                {results.results.map((result: SurveyResultItem) => (
                                    <div key={result.questionId}>
                                        <h3 className="font-medium text-sm mb-4 flex items-center gap-2">
                                            <BarChart3 className="h-4 w-4 text-primary" />
                                            {result.questionText}
                                        </h3>

                                        {result.type === "TEXT" ? (
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {"textResponses" in result && (result.textResponses?.length ?? 0) > 0 ? (
                                                    result.textResponses!.map((text: string, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            className="px-4 py-2.5 rounded-lg bg-muted/50 text-sm border border-border/40"
                                                        >
                                                            <MessageSquare className="h-3 w-3 inline mr-2 text-muted-foreground/50" />
                                                            {text}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-muted-foreground italic">No text responses yet.</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {"counts" in result && result.counts && Object.entries(result.counts)
                                                    .sort(([, a], [, b]) => (b as number) - (a as number))
                                                    .map(([option, count]) => {
                                                        const countNum = count as number
                                                        const percentage = (result.totalAnswered || 0) > 0
                                                            ? Math.round((countNum / (result.totalAnswered || 1)) * 100)
                                                            : 0
                                                        return (
                                                            <div key={option} className="group">
                                                                <div className="flex items-center justify-between text-sm mb-1">
                                                                    <span className="font-medium truncate mr-4">{option}</span>
                                                                    <span className="text-muted-foreground flex-shrink-0">
                                                                        {countNum} ({percentage}%)
                                                                    </span>
                                                                </div>
                                                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full bg-primary/70 transition-all duration-500"
                                                                        style={{ width: `${percentage}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )
                })
            )}
        </div>
    )
}
