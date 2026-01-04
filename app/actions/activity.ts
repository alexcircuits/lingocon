"use server"

import { prisma } from "@/lib/prisma"

export async function getUserActivities(userId: string, limit = 10) {
    try {
        const activities = await prisma.activity.findMany({
            where: {
                userId: userId,
            },
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
            include: {
                language: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true
                    }
                }
            },
        })

        return {
            success: true,
            data: activities,
        }
    } catch (error) {
        console.error("Error fetching activities:", error)
        return {
            success: false,
            error: "Failed to fetch activities",
        }
    }
}
