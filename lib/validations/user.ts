import { z } from "zod"

export const updateUserSchema = z.object({
    name: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }).max(30, {
        message: "Name must not be longer than 30 characters.",
    }),
    image: z.string().url({
        message: "Please enter a valid URL.",
    }).optional().or(z.literal("")),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>
