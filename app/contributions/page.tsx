import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    GitPullRequest,
    Bug,
    Lightbulb,
    FileText,
    Bot,
    Mail,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Construction
} from "lucide-react"
import Link from "next/link"
import { DiscordIcon } from "@/components/icons/discord-icon"

export const metadata = {
    title: "Contribute to LingoCon — Open Source Conlang Platform",
    description: "Help build the best open-source conlang tool. Contribute code, ideas, documentation, or AI-generated content. No experience required — all contributions welcome.",
    keywords: ["open source conlang", "contribute linguistics tool", "conlang community", "open source language tool"],
    alternates: {
        canonical: "https://lingocon.com/contributions",
    },
}

export default function ContributionsPage() {
    return (
        <main className="min-h-screen bg-background text-foreground selection:bg-accent/20">
            <Navbar />

            {/* Hero Section */}
            <section className="pt-32 pb-16 px-4 border-b border-border/40">
                <div className="container mx-auto max-w-4xl">
                    <div className="flex items-center gap-2 mb-6">
                        <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10 uppercase tracking-widest">
                            Under Resourced
                        </Badge>
                        <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 uppercase tracking-widest">
                            Open Source
                        </Badge>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-serif font-medium leading-[0.9] mb-8">
                        This project is <span className="italic text-muted-foreground">barely</span> maintained.
                        <br />
                        We need your help.
                    </h1>

                    <div className="prose prose-lg text-muted-foreground max-w-2xl font-light">
                        <p className="text-xl">
                            LingoCon is an ambitious project currently running on a skeleton crew. It works, mostly.
                            But there are bugs, missing features, and rough edges everywhere.
                        </p>
                        <p className="text-xl">
                            We don&apos;t care about &quot;clean code&quot; or &quot;perfect commits&quot; if they never happen.
                            We care about momentum. If it improves the platform, ship it.
                        </p>
                        <div className="mt-8 flex gap-4">
                            <Link href="https://discord.gg/EaVRggatDQ" target="_blank">
                                <Button size="lg" className="gap-2 h-12 px-6 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white border-0 shadow-lg shadow-[#5865F2]/20">
                                    <DiscordIcon className="w-5 h-5" />
                                    Join our Discord
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Psychological Safety Section */}
            <section className="py-16 bg-secondary/20 border-b border-border/40">
                <div className="container mx-auto max-w-4xl px-4">
                    <div className="bg-card border border-border/60 rounded-xl p-8 md:p-12 shadow-sm">
                        <h2 className="text-3xl font-serif mb-6 flex items-center gap-3">
                            <AlertCircle className="w-8 h-8 text-accent" />
                            The &quot;No Shame&quot; Policy
                        </h2>
                        <div className="space-y-4 text-lg font-light">
                            <p>
                                <strong>AI is okay.</strong> Used ChatGPT to write a glossary? Fine. Submit it.
                                It&apos;s better than an empty page.
                            </p>
                            <p>
                                <strong>Messy is okay.</strong> Your code is ugly but fixes the bug? Open the PR.
                                We can refactor later.
                            </p>
                            <p>
                                <strong>Partial is okay.</strong> Have an idea but can&apos;t code it?
                                Draft the issue. Drop a screenshot. Send an email.
                            </p>
                            <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border/40 text-base font-mono text-muted-foreground">
                                <span className="text-red-500">Silence</span> &gt; <span className="text-green-600">Bad Code</span> &gt; <span className="text-primary">Perfect Code that allows the project to die</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Segmentation Section */}
            <section className="py-24 px-4">
                <div className="container mx-auto max-w-6xl">
                    <h2 className="text-4xl font-serif mb-16 text-center">Choose your path</h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Path 1: Non-technical */}
                        <ContributionCard
                            icon={<Bug className="w-6 h-6" />}
                            title="The Observer"
                            audience="Users, Linguists"
                            time="2 mins"
                            description="Found a typo? A button that does nothing? Logic that makes no sense?"
                            action="Open an Issue"
                            href="https://github.com/alexcircuits/lingocon/issues/new"
                            color="text-red-500"
                        />

                        {/* Path 2: AI / Content */}
                        <ContributionCard
                            icon={<Bot className="w-6 h-6" />}
                            title="The Prompter"
                            audience="Anyone with ChatGPT"
                            time="10-30 mins"
                            description="Generate description examples, glossaries, or grammar explanations. Don&apos;t worry about formatting."
                            action="Submit Markdown"
                            href="https://github.com/alexcircuits/lingocon/issues/new?labels=content"
                            color="text-violet-500"
                        />

                        {/* Path 3: Developer Micro-fixes */}
                        <ContributionCard
                            icon={<GitPullRequest className="w-6 h-6" />}
                            title="The Hotfixer"
                            audience="Devs, Students"
                            time="1 hour"
                            description="Grab a &apos;good first issue&apos;. Fix a CSS alignment. Update a dependency. No strict style guide."
                            action="View Issues"
                            href="https://github.com/alexcircuits/lingocon/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22"
                            color="text-blue-500"
                        />

                        {/* Path 4: Linguistics */}
                        <ContributionCard
                            icon={<FileText className="w-6 h-6" />}
                            title="The Academic"
                            audience="Linguists, Researchers"
                            time="45 mins"
                            description="Our IPA chart logic is flawed? The glossing abbreviations are wrong? Correct our data."
                            action="Edit Data Files"
                            href="https://github.com/alexcircuits/lingocon/tree/main/actions"
                            color="text-emerald-500"
                        />

                        {/* Path 5: Ideas */}
                        <ContributionCard
                            icon={<Lightbulb className="w-6 h-6" />}
                            title="The Visionary"
                            audience="Everyone"
                            time="5 mins"
                            description="Have a wild idea for a feature? Sketch it on a napkin. Take a photo. Upload it."
                            action="Pitch Idea"
                            href="https://github.com/alexcircuits/lingocon/discussions"
                            color="text-amber-500"
                        />

                        {/* Path 6: Fallback */}
                        <ContributionCard
                            icon={<Mail className="w-6 h-6" />}
                            title="The Old School"
                            audience="GitHub Haters"
                            time="Any"
                            description="Don&apos;t want to deal with PRs? Just email us your files or thoughts directly."
                            action="Email Us"
                            href="mailto:contribute@noirsystems.com" // Placeholder email
                            color="text-foreground"
                        />
                    </div>
                </div>
            </section>

            {/* Mechanics Section */}
            <section className="py-24 bg-card border-y border-border/40">
                <div className="container mx-auto max-w-4xl px-4">
                    <h2 className="text-3xl font-serif mb-12 text-center">How to send us stuff</h2>

                    <div className="space-y-8">
                        <div className="flex gap-6 items-start">
                            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0 font-serif text-xl font-bold text-muted-foreground border border-border">1</div>
                            <div>
                                <h3 className="text-xl font-medium mb-2">GitHub is preferred (but not required)</h3>
                                <p className="text-muted-foreground font-light mb-4">
                                    If you know how to use it, fork the repo and PR. We merge fast.
                                    If you don&apos;t, use the &quot;Issues&quot; tab to drag-and-drop files or paste text.
                                </p>
                                <div className="flex gap-4">
                                    <Link href="https://github.com/alexcircuits/lingocon" target="_blank">
                                        <Button variant="outline" size="sm">Go to Repo</Button>
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-6 items-start">
                            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0 font-serif text-xl font-bold text-muted-foreground border border-border">2</div>
                            <div>
                                <h3 className="text-xl font-medium mb-2">Email Fallback</h3>
                                <p className="text-muted-foreground font-light">
                                    If Git scares you, email <code>contribute@noirsystems.com</code>. Attach your Word doc, your Python script, your napkin sketch. We&apos;ll handle the rest.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-6 items-start">
                            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0 font-serif text-xl font-bold text-muted-foreground border border-border">3</div>
                            <div>
                                <h3 className="text-xl font-medium mb-2">What happens next?</h3>
                                <p className="text-muted-foreground font-light">
                                    You won&apos;t get a corporate &quot;Thank you for your submission&quot; auto-reply.
                                    You&apos;ll get a real human (me) saying &quot;Cool, merging this&quot; or asking a question.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 
        REWARD SECTION
      */}
            <section className="py-24 px-4 overflow-hidden">
                <div className="container mx-auto max-w-4xl text-center">
                    <h2 className="text-3xl font-serif mb-8">What do you get?</h2>

                    <div className="grid md:grid-cols-2 gap-8 text-left max-w-2xl mx-auto">
                        <div className="bg-secondary/20 p-6 rounded-xl border border-border/40">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <Construction className="w-4 h-4" />
                                Permanent Credit
                            </h4>
                            <p className="text-muted-foreground font-light text-sm">
                                Every contributor gets added to the <code>AUTHORS.md</code> file.
                                Significant contributors get a spot on the &quot;Founding Contributors&quot; page (coming soon).
                            </p>
                        </div>

                        <div className="bg-secondary/20 p-6 rounded-xl border border-border/40">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Titles
                            </h4>
                            <p className="text-muted-foreground font-light text-sm">
                                Frequent contributors get titles in our Discord:
                                <span className="italic"> Language Curator</span>,
                                <span className="italic"> Code Architect</span>, etc.
                            </p>
                        </div>
                    </div>

                    <div className="mt-16">
                        <p className="text-2xl font-serif italic text-muted-foreground mb-8">
                            &quot;Perfect is the enemy of done.&quot;
                        </p>

                        <Link href="https://github.com/alexcircuits/lingocon" target="_blank">
                            <Button size="lg" className="h-14 px-8 text-lg rounded-full">
                                Make your first contribution
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    )
}

function ContributionCard({
    icon,
    title,
    audience,
    time,
    description,
    action,
    href,
    color
}: {
    icon: React.ReactNode,
    title: string,
    audience: string,
    time: string,
    description: string,
    action: string,
    href: string,
    color: string
}) {
    return (
        <div className="group relative bg-card border border-border/60 hover:border-primary/40 rounded-xl p-6 transition-all duration-300 hover:shadow-lg flex flex-col h-full">
            <div className={`mb-4 ${color} bg-background p-3 w-fit rounded-lg border border-border/40`}>
                {icon}
            </div>

            <div className="mb-4">
                <h3 className="text-xl font-semibold mb-1">{title}</h3>
                <div className="flex gap-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    <span>{audience}</span>
                    <span>•</span>
                    <span>{time}</span>
                </div>
            </div>

            <p className="text-muted-foreground font-light mb-8 text-sm leading-relaxed flex-grow">
                {description}
            </p>

            <Link href={href} target="_blank" className="mt-auto">
                <Button variant="outline" className="w-full justify-between group-hover:bg-secondary/40">
                    {action}
                    <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
                </Button>
            </Link>
        </div>
    )
}
