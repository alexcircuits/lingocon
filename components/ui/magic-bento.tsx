import { type ComponentPropsWithoutRef, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
    children: ReactNode
    className?: string
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
    name: string
    className: string
    background: ReactNode
    Icon: React.ElementType
    description: string
    href?: string
    cta?: string
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
    return (
        <div
            className={cn(
                "grid w-full auto-rows-[20rem] grid-cols-3 gap-5",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    )
}

const BentoCard = ({
    name,
    className,
    background,
    Icon,
    description,
    href,
    cta,
    ...props
}: BentoCardProps) => (
    <div
        key={name}
        className={cn(
            "group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-[28px]",
            "aurora-glass",
            className,
        )}
        {...props}
    >
        <div>{background}</div>
        <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-2 p-7 transition-all duration-300 group-hover:-translate-y-10">
            <Icon className="h-10 w-10 origin-left transform-gpu text-primary transition-all duration-300 ease-in-out group-hover:scale-90" />
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {name}
            </h3>
            <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                {description}
            </p>
        </div>

        {href && cta && (
            <div className="pointer-events-none absolute bottom-0 flex w-full translate-y-10 transform-gpu flex-row items-center p-6 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <Button variant="link" asChild size="sm" className="pointer-events-auto p-0 text-primary">
                    <Link href={href}>
                        {cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
        )}

        <div className="pointer-events-none absolute inset-0 transform-gpu rounded-[28px] transition-all duration-300 group-hover:bg-primary/[0.03]" />
    </div>
)

export { BentoCard, BentoGrid }
