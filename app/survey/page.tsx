import Link from "next/link"
import { ClipboardList, ArrowRight, Users } from "lucide-react"
import { getActiveSurveys } from "@/app/actions/survey"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "Surveys | LingoCon",
    description: "Take part in anonymous community surveys and help us improve LingoCon.",
}

export default async function SurveysPage() {
    const session = await auth()
    const isDevMode = process.env.DEV_MODE === "true"
    const surveys = await getActiveSurveys()

    const user = session?.user ? {
        id: session.user.id!,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
    } : null

    return (
        <main className="min-h-screen bg-background text-foreground">
            <Navbar user={user} isDevMode={isDevMode} />

            <div className="container mx-auto max-w-4xl px-4 pt-32 pb-24">
                {/* Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/20 text-primary text-sm font-medium mb-6">
                        <ClipboardList className="h-4 w-4" />
                        Community Surveys
                    </div>
                    <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight mb-4">
                        Your voice matters
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Help us understand our community better. All surveys are
                        <span className="text-primary font-medium"> completely anonymous</span> —
                        no account required.
                    </p>
                </div>

                {/* Survey Cards */}
                {surveys.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">
                        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-40" />
                        <p className="text-lg">No active surveys at the moment.</p>
                        <p className="text-sm mt-2">Check back soon!</p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {surveys.map((survey) => (
                            <Link
                                key={survey.id}
                                href={`/survey/${survey.slug}`}
                                className="group relative block rounded-2xl border border-border/60 bg-card p-8 transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5"
                            >
                                <div className="flex items-start justify-between gap-6">
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-serif font-medium mb-2 group-hover:text-primary transition-colors">
                                            {survey.title}
                                        </h2>
                                        {survey.description && (
                                            <p className="text-muted-foreground mb-4 leading-relaxed">
                                                {survey.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground/70">
                                            <span className="flex items-center gap-1.5">
                                                <Users className="h-3.5 w-3.5" />
                                                {survey._count.responses} response{survey._count.responses !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 mt-1 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <ArrowRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-0.5" />
                                    </div>
                                </div>

                                {/* Decorative gradient line at bottom */}
                                <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <Footer />
        </main>
    )
}
