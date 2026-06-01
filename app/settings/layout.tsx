import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getDevUserId } from "@/lib/dev-auth"
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
    const session = await auth()
    const userId = session?.user?.id || (await getDevUserId())
    const navUser = userId ? await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true, isAdmin: true },
    }) : null
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
