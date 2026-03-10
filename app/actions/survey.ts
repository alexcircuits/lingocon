"use server"

import { prisma } from "@/lib/prisma"
import { z } from "zod"

const submitResponseSchema = z.object({
    surveySlug: z.string().min(1),
    answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
})

export async function getActiveSurveys() {
    return prisma.survey.findMany({
        where: { isActive: true },
        include: {
            _count: {
                select: { responses: true },
            },
        },
        orderBy: { createdAt: "desc" },
    })
}

export async function getSurvey(slug: string) {
    return prisma.survey.findUnique({
        where: { slug },
        include: {
            questions: {
                orderBy: { order: "asc" },
            },
        },
    })
}

export async function submitSurveyResponse(input: z.infer<typeof submitResponseSchema>) {
    try {
        const validated = submitResponseSchema.parse(input)

        const survey = await prisma.survey.findUnique({
            where: { slug: validated.surveySlug },
            include: {
                questions: true,
            },
        })

        if (!survey) return { error: "Survey not found" }
        if (!survey.isActive) return { error: "This survey is no longer accepting responses" }

        // Validate that required questions are answered
        for (const question of survey.questions) {
            if (question.required && !validated.answers[question.id]) {
                return { error: `Please answer: "${question.text}"` }
            }
        }

        // Validate SELECT answers are valid options
        for (const question of survey.questions) {
            const answer = validated.answers[question.id]
            if (!answer) continue

            if (question.type === "SELECT" && question.options) {
                const options = question.options as string[]
                if (!options.includes(answer as string)) {
                    return { error: `Invalid option for: "${question.text}"` }
                }
            }

            if (question.type === "MULTI_SELECT" && question.options) {
                const options = question.options as string[]
                const selected = answer as string[]
                if (!Array.isArray(selected) || selected.some(s => !options.includes(s))) {
                    return { error: `Invalid options for: "${question.text}"` }
                }
            }
        }

        await prisma.surveyResponse.create({
            data: {
                surveyId: survey.id,
                answers: validated.answers,
            },
        })

        return { success: true }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.issues[0]?.message || "Validation failed" }
        }
        return { error: "Failed to submit response" }
    }
}

export async function getSurveyResults(surveyId: string) {
    const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        include: {
            questions: { orderBy: { order: "asc" } },
            responses: { orderBy: { createdAt: "desc" } },
        },
    })

    if (!survey) return null

    // Aggregate results per question
    const results = survey.questions.map(question => {
        const questionAnswers = survey.responses
            .map(r => (r.answers as Record<string, string | string[]>)[question.id])
            .filter(Boolean)

        if (question.type === "TEXT") {
            return {
                questionId: question.id,
                questionText: question.text,
                type: question.type,
                textResponses: questionAnswers as string[],
            }
        }

        // For SELECT / MULTI_SELECT, count occurrences
        const counts: Record<string, number> = {}
        const options = (question.options as string[]) || []
        options.forEach(o => (counts[o] = 0))

        for (const answer of questionAnswers) {
            if (Array.isArray(answer)) {
                answer.forEach(a => (counts[a] = (counts[a] || 0) + 1))
            } else {
                counts[answer as string] = (counts[answer as string] || 0) + 1
            }
        }

        return {
            questionId: question.id,
            questionText: question.text,
            type: question.type,
            counts,
            totalAnswered: questionAnswers.length,
        }
    })

    return {
        survey: {
            id: survey.id,
            title: survey.title,
            slug: survey.slug,
            description: survey.description,
            isActive: survey.isActive,
            totalResponses: survey.responses.length,
        },
        results,
    }
}

export async function getAllSurveysForAdmin() {
    return prisma.survey.findMany({
        include: {
            _count: {
                select: { responses: true, questions: true },
            },
        },
        orderBy: { createdAt: "desc" },
    })
}
