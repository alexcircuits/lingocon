import { Crown } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface MaintainerUser {
  id: string
  name: string | null
  image: string | null
}

interface MaintainersSectionProps {
  owner: MaintainerUser
  editors: MaintainerUser[]
}

export async function MaintainersSection({ owner, editors }: MaintainersSectionProps) {
  const t = await getTranslations("langPublic")
  const maintainers = [
    { user: owner, isOwner: true },
    ...editors.map((u) => ({ user: u, isOwner: false })),
  ]

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-4 px-2 text-2xl font-bold tracking-tight">
        {t("maintainers")}
        <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      </h2>
      <div className="aurora-glass rounded-3xl p-6">
        <div className="flex flex-wrap gap-4">
          {maintainers.map(({ user, isOwner }) => (
            <div key={user.id} className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback>
                    {(user.name ?? "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isOwner && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Crown className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium leading-none">
                  {user.name ?? t("anonymous")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isOwner ? t("owner") : t("editor")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
