import { requireAdmin } from "@/lib/admin"
import { AdminSidebar } from "@/components/admin/admin-sidebar"

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
            <main className="pl-64">
                <div className="min-h-screen">{children}</div>
            </main>
        </div>
    )
}
