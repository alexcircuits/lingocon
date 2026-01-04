import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  illustration?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  illustration,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed border-border/60 bg-muted/20", className)}>
      <CardHeader className="text-center py-12">
        {illustration ? (
          <div className="mx-auto mb-6">{illustration}</div>
        ) : (
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <Icon className="h-8 w-8 text-primary" />
          </div>
        )}
        <CardTitle className="text-xl font-serif mb-2">{title}</CardTitle>
        <CardDescription className="max-w-md mx-auto text-base leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
      {(action || secondaryAction) && (
        <CardContent className="flex justify-center gap-3 pb-12">
          {action && (
            <>
              {action.href ? (
                <Link href={action.href}>
                  <Button size="lg" className="shadow-sm">
                    {action.label}
                  </Button>
                </Link>
              ) : (
                <Button size="lg" onClick={action.onClick} className="shadow-sm">
                  {action.label}
                </Button>
              )}
            </>
          )}
          {secondaryAction && (
            <Button variant="outline" size="lg" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}

