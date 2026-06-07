import { useTranslations } from "next-intl"
import { Globe2, Dices, Clapperboard, GraduationCap } from "lucide-react"

const USE_CASE_KEYS = [
    { key: "worldbuilders", icon: Globe2 },
    { key: "ttrpg", icon: Dices },
    { key: "film", icon: Clapperboard },
    { key: "linguists", icon: GraduationCap },
] as const

export function UseCases() {
    const t = useTranslations("landing.useCases")
    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASE_KEYS.map((u) => {
                const Icon = u.icon
                return (
                    <div
                        key={u.key}
                        className="aurora-glass group rounded-[26px] p-7 transition-transform duration-300 hover:-translate-y-1"
                    >
                        <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                            <Icon className="h-6 w-6" />
                        </span>
                        <h3 className="text-xl font-bold tracking-tight">{t(`${u.key}.title`)}</h3>
                        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                            {t(`${u.key}.description`)}
                        </p>
                    </div>
                )
            })}
        </div>
    )
}
