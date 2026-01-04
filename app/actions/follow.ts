"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { toggleFollowSchema, type ToggleFollowInput } from "@/lib/validations/follow"

export async function toggleFollow(input: ToggleFollowInput) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
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
      return {
        success: true,
        isFollowing: true,
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to toggle follow",
    }
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
            email: true,
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
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to fetch followers",
    }
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
            email: true,
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
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to fetch following",
    }
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
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to fetch follow counts",
    }
  }
}

