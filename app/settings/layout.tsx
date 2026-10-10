import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
    title: "Settings",
    robots: {
        index: false,
        follow: false,
    },
}

export default async function SettingsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Session user (or the DEV_MODE user locally); signed-out and suspended
    // visitors go to sign in instead of crashing on the dev-only fallback.
    const userId = await getUserId()
    if (!userId) redirect("/login")
    const navUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true, isAdmin: true },
    })
    const isDevMode = process.env.DEV_MODE === "true"

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navbar user={navUser} isDevMode={isDevMode} />
            <div className="h-14" />
            <div className="flex-1">{children}</div>
            <Footer />
        </div>
    )
}
