"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getPlatformUpdates(limit = 5) {
    try {
        const updates = await prisma.platformUpdate.findMany({
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
        })

        return {
            success: true,
            data: updates,
        }
    } catch (error) {
        console.error("Error fetching platform updates:", error)
        return {
            success: false,
            error: "Failed to fetch platform updates",
        }
    }
}

export async function createPlatformUpdate(data: {
    title: string
    description: string
    icon?: string
    link?: string
}) {
    try {
        const update = await prisma.platformUpdate.create({
            data: {
                title: data.title,
                description: data.description,
                icon: data.icon,
                link: data.link,
            },
        })

        revalidatePath("/") // Revalidate home/navbar if needed

        return {
            success: true,
            data: update,
        }
    } catch (error) {
        console.error("Error creating platform update:", error)
        return {
            success: false,
            error: "Failed to create platform update",
        }
    }
}
