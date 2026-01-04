"use client"

import { useEffect, useState } from "react"
import { getUserActivities } from "@/app/actions/activity"
import { formatDistanceToNow } from "date-fns"
import {
  Activity,
  Book,
  FileText,
  Globe,
  Languages,
  Mic,
  Plus,
  Trash2,
  Edit,
  Table,
  Users
} from "lucide-react"
import Link from "next/link"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

interface ActivityFeedProps {
  userId?: string
  activities?: ActivityWithRelations[]
  showLanguage?: boolean
}

export type ActivityWithRelations = {
  id: string
  type: "CREATED" | "UPDATED" | "DELETED"
  entityType: "LANGUAGE" | "SCRIPT_SYMBOL" | "GRAMMAR_PAGE" | "DICTIONARY_ENTRY" | "PARADIGM" | "COLLABORATOR" | "ARTICLE" | "TEXT"
  entityId: string
  languageId: string
  userId: string
  description: string | null
  createdAt: Date
  language?: {
    id: string
    name: string
    slug: string
  }
}

export function ActivityFeed({ userId, activities: initialActivities, showLanguage = true }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityWithRelations[]>(initialActivities || [])
  const [loading, setLoading] = useState(!initialActivities && !!userId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialActivities) {
      setActivities(initialActivities)
      setLoading(false)
      return
    }

    if (!userId) return

    async function loadActivities() {
      setLoading(true)
      try {
        const result = await getUserActivities(userId!)
        if (result.success && result.data) {
          // @ts-ignore - Date serialization issue from server action
          setActivities(result.data)
        } else {
          setError("Failed to load activities")
        }
      } catch (err) {
        console.error(err)
        setError("An error occurred")
      } finally {
        setLoading(false)
      }
    }

    loadActivities()
  }, [userId, initialActivities])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 p-4 border rounded-xl bg-card/50">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-8 text-muted-foreground">Unable to load activity feed.</div>
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
          <Activity className="h-8 w-8 opacity-50" />
        </div>
        <p>No recent activity found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="group flex gap-4 p-4 border rounded-xl bg-card hover:bg-muted/30 transition-colors">
          <ActivityIcon type={activity.type} entityType={activity.entityType} />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-none mb-1.5 text-foreground/90">
              <ActivityMessage activity={activity} showLanguage={showLanguage} />
            </p>

            {activity.description && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2 italic">
                &quot;{activity.description}&quot;
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {showLanguage && activity.language && (
                <>
                  <Link
                    href={`/studio/lang/${activity.language.slug}`}
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <Globe className="h-3 w-3" />
                    {activity.language.name}
                  </Link>
                  <span>•</span>
                </>
              )}
              <span>{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityIcon({ type, entityType }: { type: string, entityType: string }) {
  let Icon = Activity
  let colorClass = "bg-muted text-muted-foreground"

  // Determine Icon based on entity type
  switch (entityType) {
    case "LANGUAGE":
      Icon = Languages
      break
    case "GRAMMAR_PAGE":
      Icon = FileText
      break
    case "DICTIONARY_ENTRY":
      Icon = Book
      break
    case "SCRIPT_SYMBOL":
      Icon = Mic // Or generic text icon
      break
    case "PARADIGM":
      Icon = Table
      break
    case "COLLABORATOR":
      Icon = Users
      break
    default:
      Icon = Activity
  }

  // Determine color based on action type
  if (type === "CREATED") {
    colorClass = "bg-green-500/10 text-green-600 dark:text-green-400"
  } else if (type === "UPDATED") {
    colorClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400"
  } else if (type === "DELETED") {
    colorClass = "bg-red-500/10 text-red-600 dark:text-red-400"
  }

  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
      <Icon className="h-5 w-5" />
      <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5">
        {type === "CREATED" && <Plus className="h-3 w-3 text-green-600" />}
        {type === "UPDATED" && <Edit className="h-3 w-3 text-blue-600" />}
        {type === "DELETED" && <Trash2 className="h-3 w-3 text-red-600" />}
      </div>
    </div>
  )
}

function ActivityMessage({ activity, showLanguage }: { activity: ActivityWithRelations, showLanguage: boolean }) {
  const action = activity.type === "CREATED" ? "Created" : activity.type === "UPDATED" ? "Updated" : "Deleted"
  // Use proper case for display
  const entity = activity.entityType.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')

  return (
    <>
      {action} {entity === "Language" ? "a new language" : entity.toLowerCase()}
      {showLanguage && (
        <> for <span className="font-semibold text-foreground">{activity.language?.name || "Deleted Language"}</span></>
      )}
    </>
  )
}
