import { notFound } from "next/navigation"
import { getSurvey } from "@/app/actions/survey"
import { SurveyForm } from "@/components/survey/survey-form"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { slug: string } }) {
    const survey = await getSurvey(params.slug)
    if (!survey) return { title: "Survey Not Found | LingoCon" }
    return {
        title: `${survey.title} | LingoCon Survey`,
        description: survey.description || "Take an anonymous community survey on LingoCon.",
    }
}

export default async function SurveyPage({ params }: { params: { slug: string } }) {
    const session = await auth()
    const isDevMode = process.env.DEV_MODE === "true"
    const survey = await getSurvey(params.slug)

    if (!survey || !survey.isActive) {
        notFound()
    }

    const user = session?.user ? {
        id: session.user.id!,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
    } : null

    // Serialize for client component
    const serializedSurvey = {
        id: survey.id,
        title: survey.title,
        slug: survey.slug,
        description: survey.description,
        questions: survey.questions.map(q => ({
            id: q.id,
            text: q.text,
            type: q.type,
            options: q.options as string[] | null,
            required: q.required,
            order: q.order,
        })),
    }

    return (
        <main className="min-h-screen bg-background text-foreground">
            <Navbar user={user} isDevMode={isDevMode} />

            <div className="container mx-auto max-w-2xl px-4 pt-32 pb-24">
                <SurveyForm survey={serializedSurvey} />
            </div>

            <Footer />
        </main>
    )
}
