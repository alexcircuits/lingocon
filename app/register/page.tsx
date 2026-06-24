import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Languages, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Navbar } from "@/components/navbar"
import { RegisterForm } from "./components/register-form"

export default async function RegisterPage() {
    const t = await getTranslations("auth")
    const tCommon = await getTranslations("common")
    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Background Effects */}
            <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            <div className="fixed inset-0 -z-10 bg-gradient-to-b from-background via-transparent to-background"></div>

            <Navbar />

            <div className="h-14" />

            <div className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-sm space-y-8 relative z-10">
                    <div className="text-center space-y-2">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 mb-4">
                            <Languages className="h-6 w-6" />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight">{t("registerTitle")}</h1>
                        <p className="text-muted-foreground">
                            {t("registerSubtitle")}
                        </p>
                    </div>

                    <Card className="border-border/60 shadow-lg bg-card/80 backdrop-blur-sm">
                        <CardContent className="pt-6">
                            <RegisterForm />

                            <div className="mt-6 text-center text-sm">
                                <span className="text-muted-foreground">{t("hasAccount")} </span>
                                <Link href="/login" className="text-primary hover:underline font-medium">
                                    {tCommon("signIn")}
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="text-center">
                        <Link
                            href="/"
                            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="mr-1.5 h-4 w-4" />
                            {t("backToHome")}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
