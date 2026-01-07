import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HeroBackground } from "@/components/hero-background"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Mail, MessageSquare } from "lucide-react"
import Link from "next/link"
import { auth } from "@/auth"

export const metadata = {
    title: "Contact Us | LingoCon",
    description: "Get in touch with the LingoCon team for support, feedback, or inquiries.",
}

export default async function ContactPage() {
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

                <div className="container mx-auto max-w-4xl relative z-10 text-center">
                    <Badge
                        variant="outline"
                        className="mb-8 px-4 py-1.5 text-sm font-medium border-primary/20 bg-primary/5 text-primary rounded-full backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700 font-mono tracking-wide"
                    >
                        Get in Touch
                    </Badge>

                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-medium tracking-tight mb-8 leading-[1.1] text-foreground">
                        We&apos;d love to hear from you
                    </h1>

                    <p className="text-xl text-muted-foreground mb-16 max-w-2xl mx-auto leading-relaxed font-light">
                        Have a question, suggestion, or just want to say hello?
                        We&apos;re always looking for feedback to make LingoCon better.
                    </p>

                    <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                        {/* Support Email */}
                        <div className="bg-secondary/10 border border-border/40 backdrop-blur-sm rounded-2xl p-8 hover:bg-secondary/20 transition-all duration-300 group">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 text-primary group-hover:scale-110 transition-transform">
                                <Mail className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Support</h3>
                            <p className="text-muted-foreground mb-6 text-sm">
                                For technical issues, account help, or bug reports.
                            </p>
                            <Button asChild variant="outline" className="rounded-full">
                                <Link href="mailto:support@noirsystems.com">
                                    support@noirsystems.com
                                </Link>
                            </Button>
                        </div>

                        {/* General Inquiries */}
                        <div className="bg-secondary/10 border border-border/40 backdrop-blur-sm rounded-2xl p-8 hover:bg-secondary/20 transition-all duration-300 group">
                            <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-6 text-violet-500 group-hover:scale-110 transition-transform">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">General Inquiries</h3>
                            <p className="text-muted-foreground mb-6 text-sm">
                                For feedback, feature requests, or partnerships.
                            </p>
                            <Button asChild variant="outline" className="rounded-full">
                                <Link href="mailto:hello@noirsystems.com">
                                    hello@noirsystems.com
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
