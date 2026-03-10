import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function seedSurvey() {
    console.log("🌱 Seeding Community Profile survey...")

    const survey = await prisma.survey.upsert({
        where: { slug: "community-profile" },
        update: {
            title: "Community Profile",
            description: "Help us understand our community better! This survey is completely anonymous.",
        },
        create: {
            title: "Community Profile",
            slug: "community-profile",
            description: "Help us understand our community better! This survey is completely anonymous.",
            isActive: true,
        },
    })

    // Delete existing questions to re-create them
    await prisma.surveyQuestion.deleteMany({
        where: { surveyId: survey.id },
    })

    const questions = [
        {
            text: "What country are you from?",
            type: "SELECT" as const,
            required: true,
            order: 1,
            options: [
                "United States",
                "United Kingdom",
                "Canada",
                "Germany",
                "France",
                "Spain",
                "Italy",
                "Netherlands",
                "Poland",
                "Ukraine",
                "Russia",
                "Brazil",
                "Argentina",
                "Mexico",
                "Australia",
                "Japan",
                "South Korea",
                "India",
                "China",
                "Sweden",
                "Norway",
                "Finland",
                "Other",
            ],
        },
        {
            text: "What is your affiliation?",
            type: "SELECT" as const,
            required: true,
            order: 2,
            options: [
                "University student",
                "University staff / researcher",
                "School student",
                "School teacher",
                "Self-taught enthusiast",
                "Hobbyist conlanger",
                "Professional linguist",
                "Writer / Worldbuilder",
                "Other",
            ],
        },
        {
            text: "If university or school — which one? (optional)",
            type: "TEXT" as const,
            required: false,
            order: 3,
            options: null,
        },
        {
            text: "How did you find LingoCon?",
            type: "SELECT" as const,
            required: true,
            order: 4,
            options: [
                "Reddit",
                "Discord",
                "Twitter / X",
                "YouTube",
                "Google Search",
                "Friend or colleague",
                "University / class",
                "Other",
            ],
        },
    ]

    for (const q of questions) {
        await prisma.surveyQuestion.create({
            data: {
                surveyId: survey.id,
                text: q.text,
                type: q.type,
                required: q.required,
                order: q.order,
                options: q.options ?? undefined,
            },
        })
    }

    console.log(`✅ Created survey "${survey.title}" with ${questions.length} questions`)
}

seedSurvey()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
