"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { UserPlus, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toggleFollow, checkIsFollowing } from "@/app/actions/follow"
import { cn } from "@/lib/utils"

interface FollowButtonProps {
  followingId: string
  className?: string
  variant?: "default" | "outline" | "ghost"
  size?: "sm" | "md" | "lg"
  showIcon?: boolean
}

export function FollowButton({
  followingId,
  className,
  variant = "default",
  size = "md",
  showIcon = true,
}: FollowButtonProps) {
  const { data: session } = useSession()
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)

  useEffect(() => {
    if (session?.user?.id && session.user.id !== followingId) {
      checkIsFollowing(followingId, session.user.id).then((result) => {
        if (result.success) {
          setIsFollowing(result.isFollowing)
        }
        setIsLoading(false)
      })
    } else {
      setIsLoading(false)
    }
  }, [followingId, session?.user?.id])

  const handleToggle = async () => {
    if (!session?.user) {
      toast.error("Please sign in to follow users")
      return
    }

    if (session.user.id === followingId) {
      return
    }

    setIsToggling(true)
    const result = await toggleFollow({ followingId })

    if (result.error) {
      toast.error(result.error)
    } else {
      setIsFollowing(result.isFollowing || false)
      toast.success(
        result.isFollowing
          ? "Now following this user"
          : "Unfollowed this user"
      )
    }
    setIsToggling(false)
  }

  // Don't show button if not logged in or trying to follow self
  if (!session?.user || session.user.id === followingId) {
    return null
  }

  const sizeClasses = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  }

  return (
    <Button
      variant={isFollowing ? "outline" : variant}
      onClick={handleToggle}
      disabled={isLoading || isToggling}
      className={cn(sizeClasses[size], className)}
      aria-label={isFollowing ? "Unfollow" : "Follow"}
    >
      {showIcon && (
        <>
          {isFollowing ? (
            <UserCheck className="mr-2 h-4 w-4" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
        </>
      )}
      {isToggling
        ? "Loading..."
        : isFollowing
        ? "Following"
        : "Follow"}
    </Button>
  )
}

