"use server"

import { prisma } from "@/lib/prisma"
import { toActionError } from "@/lib/errors"
import { getUserId } from "@/lib/auth-helpers"
import { toggleFollowSchema, type ToggleFollowInput } from "@/lib/validations/follow"
import { checkFollowerBadges } from "@/app/actions/badge"
import { createNotification } from "@/lib/notifications"
import { rateLimit } from "@/lib/rate-limit"

export async function toggleFollow(input: ToggleFollowInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }
  // Each follow notifies the followed user; toggling in a loop would spam them.
  if (!rateLimit(`follow:${userId}`, 30, 60_000).ok) {
    return { error: "Too many requests — please wait a moment." }
  }

  try {
    const validated = toggleFollowSchema.parse(input)

    // Prevent self-follow
    if (userId === validated.followingId) {
      return {
        error: "Cannot follow yourself",
      }
    }

    // Check if follow already exists
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: validated.followingId,
        },
      },
    })

    if (existing) {
      // Unfollow
      await prisma.follow.delete({
        where: {
          id: existing.id,
        },
      })
      return {
        success: true,
        isFollowing: false,
      }
    } else {
      // Follow
      await prisma.follow.create({
        data: {
          followerId: userId,
          followingId: validated.followingId,
        },
      })

      // Notify the followed user (best-effort).
      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, image: true },
      })
      await createNotification({
        recipientId: validated.followingId,
        type: "NEW_FOLLOWER",
        actorId: userId,
        data: {
          actorName: actor?.name ?? "Someone",
          actorImage: actor?.image ?? null,
          href: `/users/${userId}`,
        },
      })

      // Check for follower badges for the user being followed
      checkFollowerBadges(validated.followingId).catch(console.error)

      return {
        success: true,
        isFollowing: true,
      }
    }
  } catch (error) {
    return { ...toActionError(error, "Failed to toggle follow") }
  }
}

export async function getFollowers(userId: string) {
  try {
    const followers = await prisma.follow.findMany({
      where: {
        followingId: userId,
      },
      include: {
        follower: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return {
      success: true,
      data: followers.map((f) => f.follower),
    }
  } catch (error) {
    return { ...toActionError(error, "Failed to fetch followers") }
  }
}

export async function getFollowing(userId: string) {
  try {
    const following = await prisma.follow.findMany({
      where: {
        followerId: userId,
      },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return {
      success: true,
      data: following.map((f) => f.following),
    }
  } catch (error) {
    return { ...toActionError(error, "Failed to fetch following") }
  }
}

export async function checkIsFollowing(followingId: string, userId: string) {
  try {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId,
        },
      },
    })

    return {
      success: true,
      isFollowing: !!follow,
    }
  } catch (error) {
    return {
      success: true,
      isFollowing: false,
    }
  }
}

export async function getFollowCounts(userId: string) {
  try {
    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({
        where: {
          followingId: userId,
        },
      }),
      prisma.follow.count({
        where: {
          followerId: userId,
        },
      }),
    ])

    return {
      success: true,
      followers: followersCount,
      following: followingCount,
    }
  } catch (error) {
    return { ...toActionError(error, "Failed to fetch follow counts") }
  }
}

