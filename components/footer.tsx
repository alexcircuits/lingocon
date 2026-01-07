import Link from "next/link"
import { Languages } from "lucide-react"

export function Footer() {
    return (
        <footer className="border-t border-border/40 bg-secondary/10 relative overflow-hidden mt-auto">
            <div className="container mx-auto px-4 py-12 relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Languages className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">LingoCon</span>
                    </div>

                    <nav className="flex items-center gap-8 text-sm font-medium text-muted-foreground">
                        <Link href="/browse" className="hover:text-primary transition-colors">
                            Browse
                        </Link>
                        <Link href="/contact" className="hover:text-primary transition-colors">
                            Contact
                        </Link>
                        <Link href="/login" className="hover:text-primary transition-colors">
                            Login
                        </Link>
                    </nav>

                    <div className="text-sm text-muted-foreground/60 text-center md:text-right">
                        <p className="mb-1">v1.1 Public Beta © {new Date().getFullYear()} LingoCon.</p>
                        <p>
                            Made by team{" "}
                            <Link
                                href="https://noirsystems.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-foreground hover:text-primary transition-colors hover:underline"
                            >
                                NoirSystems
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    )
}
