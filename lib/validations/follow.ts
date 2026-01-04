import { z } from "zod"

export const toggleFollowSchema = z.object({
  followingId: z.string().min(1),
})

export type ToggleFollowInput = z.infer<typeof toggleFollowSchema>

