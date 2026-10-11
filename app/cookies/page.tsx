import Link from "next/link"
import { getFormatter, getTranslations } from "next-intl/server"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/auth"

/** Change when the list below changes. */
const UPDATED = new Date("2026-10-11T00:00:00Z")

export async function generateMetadata() {
    const t = await getTranslations("cookies.page")
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
    }
}

interface Row {
    names: string[]
    purpose: string
    duration: string
}

function StorageTable({ rows, labels }: { rows: Row[]; labels: { name: string; purpose: string; duration: string } }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                        <th scope="col" className="w-[36%] px-4 py-3 font-medium">{labels.name}</th>
                        <th scope="col" className="px-4 py-3 font-medium">{labels.purpose}</th>
                        <th scope="col" className="px-4 py-3 font-medium">{labels.duration}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.names[0]} className="border-t border-border/60 align-top">
                            <td className="px-4 py-3">
                                {row.names.map((name) => (
                                    <code key={name} className="block text-xs [overflow-wrap:anywhere]">{name}</code>
                                ))}
                            </td>
                            <td className="px-4 py-3">{row.purpose}</td>
                            <td className="px-4 py-3 text-muted-foreground">{row.duration}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export default async function CookiesPage() {
    const session = await auth()
    const isDevMode = process.env.DEV_MODE === "true"
    const [t, format] = await Promise.all([getTranslations("cookies.page"), getFormatter()])

    const user = session?.user ? {
        id: session.user.id!,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
    } : null

    const labels = { name: t("colName"), purpose: t("colPurpose"), duration: t("colDuration") }
    // On https the Auth.js cookies carry a __Secure- (or __Host-) prefix.
    const cookies: Row[] = [
        { names: ["authjs.session-token"], purpose: t("sessionPurpose"), duration: t("sessionDuration") },
        { names: ["authjs.csrf-token"], purpose: t("csrfPurpose"), duration: t("browserSession") },
        { names: ["authjs.callback-url"], purpose: t("callbackPurpose"), duration: t("browserSession") },
        { names: ["authjs.state", "authjs.pkce.code_verifier"], purpose: t("oauthPurpose"), duration: t("oauthDuration") },
        { names: ["NEXT_LOCALE"], purpose: t("localePurpose"), duration: t("localeDuration") },
    ]
    const storage: Row[] = [
        { names: ["theme"], purpose: t("themePurpose"), duration: t("untilCleared") },
        { names: ["palette"], purpose: t("palettePurpose"), duration: t("untilCleared") },
        {
            names: [
                "lingocon-cookie-notice-dismissed",
                "lingocon-survey-banner-dismissed",
                "lingocon-survey-completed",
                "pwa-install-dismissed",
                "dashboard-tour-completed",
                "feature-…-dismissed",
                "validation-warnings-dismissed:…",
            ],
            purpose: t("dismissalsPurpose"),
            duration: t("untilCleared"),
        },
        { names: ["lingocon_last_seen_notification"], purpose: t("notificationsPurpose"), duration: t("untilCleared") },
        { names: ["browseView"], purpose: t("browseViewPurpose"), duration: t("untilCleared") },
        { names: ["lingocon:chunk-reload-at"], purpose: t("chunkReloadPurpose"), duration: t("tabSession") },
        { names: ["lingocon-static-v2"], purpose: t("offlinePurpose"), duration: t("offlineDuration") },
    ]
    const statsPoints = ["statsNoCookie", "statsNoIp", "statsPaths", "statsDetails", "statsSignedIn", "statsRetention", "statsOptOut", "statsServerLogs"] as const

    return (
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-background text-foreground overflow-x-hidden flex flex-col">
            <Navbar user={user} isDevMode={isDevMode} />

            <article className="container mx-auto max-w-3xl px-4 pt-32 pb-20 md:pt-40 flex-1 space-y-12">
                <header className="space-y-4">
                    <Badge variant="outline" className="px-3 py-1 font-mono tracking-wide border-primary/20 bg-primary/5 text-primary rounded-full">
                        {t("eyebrow")}
                    </Badge>
                    <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight">{t("title")}</h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">{t("intro")}</p>
                    <p className="text-sm text-muted-foreground">
                        {t("updated", { date: format.dateTime(UPDATED, { dateStyle: "long", timeZone: "UTC" }) })}
                    </p>
                </header>

                <section aria-labelledby="cookies-heading" className="space-y-4">
                    <h2 id="cookies-heading" className="text-2xl font-serif">{t("cookiesTitle")}</h2>
                    <p className="text-muted-foreground leading-relaxed">{t("cookiesIntro")}</p>
                    <StorageTable rows={cookies} labels={labels} />
                </section>

                <section aria-labelledby="storage-heading" className="space-y-4">
                    <h2 id="storage-heading" className="text-2xl font-serif">{t("storageTitle")}</h2>
                    <p className="text-muted-foreground leading-relaxed">{t("storageIntro")}</p>
                    <StorageTable rows={storage} labels={labels} />
                </section>

                <section aria-labelledby="stats-heading" className="space-y-4">
                    <h2 id="stats-heading" className="text-2xl font-serif">{t("statsTitle")}</h2>
                    <p className="text-muted-foreground leading-relaxed">{t("statsIntro")}</p>
                    <ul className="list-disc space-y-2 pl-6 leading-relaxed">
                        {statsPoints.map((key) => (
                            <li key={key}>{t(key)}</li>
                        ))}
                    </ul>
                </section>

                <section aria-labelledby="third-party-heading" className="space-y-4">
                    <h2 id="third-party-heading" className="text-2xl font-serif">{t("thirdPartyTitle")}</h2>
                    <p className="text-muted-foreground leading-relaxed">{t("thirdParty")}</p>
                </section>

                <section aria-labelledby="choices-heading" className="space-y-4">
                    <h2 id="choices-heading" className="text-2xl font-serif">{t("choicesTitle")}</h2>
                    <p className="text-muted-foreground leading-relaxed">{t("choices")}</p>
                    <p className="text-muted-foreground leading-relaxed">
                        {t.rich("contact", {
                            link: (chunks) => <Link href="/contact" className="text-primary underline underline-offset-4">{chunks}</Link>,
                        })}
                    </p>
                </section>
            </article>

            <Footer />
        </main>
    )
}
