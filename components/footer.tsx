import Link from "next/link"
import { Languages, Github, Heart } from "lucide-react"
import { useTranslations } from "next-intl"

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className={className}>
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.176 2.419 0 1.334-.965 2.419-2.176 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.176 2.419 0 1.334-.966 2.419-2.176 2.419z" />
    </svg>
)

export function Footer() {
    const t = useTranslations("footer");

    const productLinks = [
        { name: t("dashboard"), href: "/dashboard" },
        { name: t("browseLanguages"), href: "/browse" },
        { name: t("languageFamilies"), href: "/families" },
        { name: t("search"), href: "/search" },
    ]

    const communityLinks = [
        { name: t("discord"), href: "https://discord.gg/EaVRggatDQ", external: true },
        { name: t("contribute"), href: "/contributions" },
        { name: t("communitySurvey"), href: "/survey" },
        { name: t("developerDocs"), href: "/docs" },
    ]

    const legalLinks = [
        { name: t("contact"), href: "/contact" },
        { name: t("donate"), href: "/donate" },
        { name: t("github"), href: "https://github.com/alexcircuits/lingocon", external: true },
    ]

    return (
        <footer className="border-t border-border/40 bg-foreground text-background relative overflow-hidden mt-auto">
            {/* Decorative glyph pattern */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none select-none overflow-hidden">
                <div className="text-[200px] font-serif leading-none tracking-tighter whitespace-nowrap">
                    ᚱ ꦏ Ω ᛟ გ अ ع ש ᜀ ᓀ θ Ψ ᚠ 愛 ⴀ
                </div>
            </div>

            <div className="container mx-auto px-4 py-16 relative z-10">
                {/* Main footer grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Brand Column */}
                    <div className="lg:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <Languages className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-lg tracking-tight">LingoCon</span>
                        </div>
                        <p className="text-sm text-background/60 leading-relaxed mb-6 max-w-xs">
                            {t("tagline")}
                        </p>
                        <div className="flex items-center gap-3">
                            <Link
                                href="https://github.com/alexcircuits/lingocon"
                                target="_blank"
                                className="flex items-center justify-center w-9 h-9 rounded-lg bg-background/10 hover:bg-background/20 transition-colors"
                                aria-label={t("github")}
                            >
                                <Github className="h-4 w-4" />
                            </Link>
                            <Link
                                href="https://discord.gg/EaVRggatDQ"
                                target="_blank"
                                className="flex items-center justify-center w-9 h-9 rounded-lg bg-background/10 hover:bg-background/20 transition-colors"
                                aria-label={t("discord")}
                            >
                                <DiscordIcon className="h-4 w-4" />
                            </Link>
                            <Link
                                href="https://opencollective.com/lingocon"
                                target="_blank"
                                className="flex items-center justify-center w-9 h-9 rounded-lg bg-background/10 hover:bg-background/20 transition-colors"
                                aria-label={t("openCollective")}
                            >
                                <Heart className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-background/40 mb-4">{t("product")}</h4>
                        <nav className="flex flex-col gap-2.5">
                            {productLinks.map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="text-sm text-background/60 hover:text-background transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    {/* Community Links */}
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-background/40 mb-4">{t("community")}</h4>
                        <nav className="flex flex-col gap-2.5">
                            {communityLinks.map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    target={"external" in link ? "_blank" : undefined}
                                    className="text-sm text-background/60 hover:text-background transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    {/* Info & Support */}
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-background/40 mb-4">{t("support")}</h4>
                        <nav className="flex flex-col gap-2.5">
                            {legalLinks.map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    target={"external" in link ? "_blank" : undefined}
                                    className="text-sm text-background/60 hover:text-background transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="pt-8 border-t border-background/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-background/40">
                        {t("copyright", { year: new Date().getFullYear() })}
                    </p>
                    <p className="text-xs text-background/40 italic flex items-center flex-wrap justify-center">
                        {t("madeWith")} <Heart className="h-3 w-3 inline fill-rose-400 text-rose-400 mx-1" />
                    </p>
                </div>
            </div>
        </footer>
    )
}
