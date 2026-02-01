import { requireAdmin } from "@/lib/admin"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav"

export const metadata = {
    title: "Admin Dashboard",
    robots: {
        index: false,
        follow: false,
    },
}

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Protect all admin routes
    await requireAdmin()


    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar />

            {/* Mobile Header */}
            <div className="md:hidden flex items-center h-16 border-b px-4 bg-card fixed top-0 left-0 right-0 z-30">
                <AdminMobileNav />
                <span className="ml-2 text-lg font-semibold">Admin Panel</span>
            </div>

            <main className="pt-16 md:pt-0 md:pl-64">
                <div className="min-h-screen">{children}</div>
            </main>
        </div>
    )
}
