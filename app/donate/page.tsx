import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HeroBackground } from "@/components/hero-background"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Heart, Coffee, Users, Globe2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { auth } from "@/auth"

export const metadata = {
    title: "Support LingoCon | Donate",
    description: "Support the open-source development of LingoCon through OpenCollective.",
}

export default async function DonatePage() {
    const session = await auth()
    const isDevMode = process.env.DEV_MODE === "true"

    const user = session?.user ? {
        id: session.user.id!,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
    } : null

    return (
        <main className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20 flex flex-col">
            <Navbar user={user} isDevMode={isDevMode} />

            <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4 overflow-hidden flex-1 flex flex-col justify-center">
                <HeroBackground />

                <div className="container mx-auto max-w-5xl relative z-10 text-center">
                    <Badge
                        variant="outline"
                        className="mb-8 px-4 py-1.5 text-sm font-medium border-rose-500/30 bg-rose-500/10 text-rose-500 rounded-full backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700 font-mono tracking-wide"
                    >
                        <Heart className="w-3.5 h-3.5 mr-2 inline-block fill-current" />
                        Support Our Mission
                    </Badge>

                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-medium tracking-tight mb-8 leading-[1.1] text-foreground">
                        Help us keep <span className="text-primary">LingoCon</span> free & open
                    </h1>

                    <p className="text-xl text-muted-foreground mb-16 max-w-2xl mx-auto leading-relaxed font-light">
                        LingoCon is an open-source platform driven by passion for languages. 
                        Your contribution helps us cover server costs, develop new features, and keep the application accessible to everyone.
                    </p>

                    <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16 text-left">
                        {/* Server Costs */}
                        <div className="bg-secondary/20 border border-border/50 backdrop-blur-md rounded-2xl p-6 hover:bg-secondary/30 transition-all duration-300">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500">
                                <Globe2 className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Infrastructure</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Helps cover databases, cloud hosting, and storage for thousands of languages.
                            </p>
                        </div>

                        {/* Open Source */}
                        <div className="bg-secondary/20 border border-border/50 backdrop-blur-md rounded-2xl p-6 hover:bg-secondary/30 transition-all duration-300">
                            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-4 text-green-500">
                                <Users className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Open Source</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Funds development bounties to reward public contributors and maintainers.
                            </p>
                        </div>

                        {/* Development */}
                        <div className="bg-secondary/20 border border-border/50 backdrop-blur-md rounded-2xl p-6 hover:bg-secondary/30 transition-all duration-300">
                            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 text-amber-500">
                                <Coffee className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Development</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Fuels the countless hours and coffee needed to build and improve the app.
                            </p>
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 backdrop-blur-md rounded-3xl p-8 md:p-12 max-w-3xl mx-auto">
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm">
                                {/* Open Collective Logo approximation using standard elements or icon */}
                                <div className="w-8 h-8 rounded-full border-4 border-slate-800 border-r-transparent border-t-transparent -rotate-45" />
                            </div>
                            <h2 className="text-2xl md:text-3xl font-medium mb-4">We are on OpenCollective</h2>
                            <p className="text-muted-foreground mb-8 max-w-lg text-center">
                                All financial transactions are transparent and public. You can see exactly how the funds are used to support the project.
                            </p>
                            
                            <Button asChild size="lg" className="rounded-full px-8 text-base h-14 group">
                                <Link href="https://opencollective.com/lingocon" target="_blank" rel="noopener noreferrer">
                                    Donate via OpenCollective
                                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    )
}
