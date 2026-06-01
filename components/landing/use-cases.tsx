import { Globe2, Dices, Clapperboard, GraduationCap } from "lucide-react"

const USE_CASES = [
    {
        icon: Globe2,
        title: "Worldbuilders",
        description:
            "Give your fantasy world a language with real depth — names, place-names and lore that hold together.",
    },
    {
        icon: Dices,
        title: "TTRPG & games",
        description:
            "Craft tongues for factions and races your players can actually read, speak and discover.",
    },
    {
        icon: Clapperboard,
        title: "Film & fiction",
        description:
            "Document a consistent constructed language for scripts, subtitles and on-screen writing.",
    },
    {
        icon: GraduationCap,
        title: "Linguists & students",
        description:
            "Experiment with phonology, morphology and typology in a structured, exportable workspace.",
    },
]

export function UseCases() {
    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u) => {
                const Icon = u.icon
                return (
                    <div
                        key={u.title}
                        className="aurora-glass group rounded-[26px] p-7 transition-transform duration-300 hover:-translate-y-1"
                    >
                        <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                            <Icon className="h-6 w-6" />
                        </span>
                        <h3 className="text-xl font-bold tracking-tight">{u.title}</h3>
                        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                            {u.description}
                        </p>
                    </div>
                )
            })}
        </div>
    )
}
