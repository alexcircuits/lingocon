import Link from "next/link"
import { Heart, Coffee } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SupportWidget() {
    return (
        <div className="relative overflow-hidden rounded-xl border border-rose-500/20 bg-gradient-to-b from-rose-500/5 to-transparent p-5 sm:p-6 transition-all hover:border-rose-500/40">
            {/* Background flourish */}
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-rose-500/10 blur-2xl" />
            <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl" />

            <div className="relative z-10">
                <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                        <Heart className="h-4 w-4 fill-rose-500/20" />
                    </div>
                    <h3 className="font-semibold tracking-tight text-foreground">Support LingoCon</h3>
                </div>
                
                <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                    LingoCon is an open-source project. If it has helped you build your world, consider supporting our server costs!
                </p>
                
                <Button asChild variant="outline" className="w-full gap-2 border-rose-500/20 bg-background/50 hover:bg-rose-500/10 hover:text-rose-600 transition-colors">
                    <Link href="/donate">
                        <Coffee className="h-4 w-4" />
                        Buy us a coffee
                    </Link>
                </Button>
            </div>
        </div>
    )
}
