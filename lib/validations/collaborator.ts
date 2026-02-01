import { z } from "zod"

export const collaboratorRoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"])

export const inviteCollaboratorSchema = z.object({
  languageId: z.string().min(1),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  userId: z.string().optional(),
  role: collaboratorRoleSchema,
}).refine((data) => data.email || data.userId, {
  message: "Either email or user selection is required",
  path: ["email"],
})

export const updateCollaboratorRoleSchema = z.object({
  languageId: z.string().min(1),
  userId: z.string().min(1),
  role: collaboratorRoleSchema,
})

export const removeCollaboratorSchema = z.object({
  languageId: z.string().min(1),
  userId: z.string().min(1),
})

