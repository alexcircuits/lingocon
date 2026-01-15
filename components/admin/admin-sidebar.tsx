"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    Users,
    Languages,
    BarChart3,
    FileText,
    Settings,
    Shield,
    ArrowLeft
} from "lucide-react"

const navItems = [
    {
        title: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard
    },
    {
        title: "Users",
        href: "/admin/users",
        icon: Users
    },
    {
        title: "Languages",
        href: "/admin/languages",
        icon: Languages
    },
    {
        title: "Analytics",
        href: "/admin/analytics",
        icon: BarChart3
    },
    {
        title: "Content",
        href: "/admin/content",
        icon: FileText
    },
    {
        title: "System",
        href: "/admin/system",
        icon: Settings
    }
]

export function AdminSidebar() {
    const pathname = usePathname()

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
            <div className="flex h-full flex-col">
                {/* Header */}
                <div className="flex h-16 items-center gap-2 border-b border-border px-6">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="text-lg font-semibold">Admin Panel</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1 px-3 py-4">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href !== "/admin" && pathname.startsWith(item.href))

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.title}
                            </Link>
                        )
                    })}
                </nav>

                {/* Footer */}
                <div className="border-t border-border p-4">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </aside>
    )
}
