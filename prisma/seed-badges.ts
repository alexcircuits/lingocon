import { PrismaClient, BadgeTier, BadgeCategory } from "@prisma/client"

const prisma = new PrismaClient()

interface BadgeDefinition {
    key: string
    name: string
    description: string
    icon: string
    tier: BadgeTier
    category: BadgeCategory
    threshold: number
}

const badges: BadgeDefinition[] = [
    // Language Badges
    {
        key: "first_language",
        name: "Worldbuilder",
        description: "Create your first language",
        icon: "🌍",
        tier: "BRONZE",
        category: "LANGUAGES",
        threshold: 1,
    },
    {
        key: "languages_5",
        name: "Polyglot",
        description: "Create 5 languages",
        icon: "🗣️",
        tier: "SILVER",
        category: "LANGUAGES",
        threshold: 5,
    },
    {
        key: "languages_10",
        name: "Language Architect",
        description: "Create 10 languages",
        icon: "🏛️",
        tier: "GOLD",
        category: "LANGUAGES",
        threshold: 10,
    },
    {
        key: "first_publish",
        name: "Going Public",
        description: "Publish your first language to the world",
        icon: "🚀",
        tier: "BRONZE",
        category: "LANGUAGES",
        threshold: 1,
    },

    // Dictionary Badges
    {
        key: "dictionary_50",
        name: "Word Collector",
        description: "Add 50 dictionary entries across all languages",
        icon: "📝",
        tier: "BRONZE",
        category: "DICTIONARY",
        threshold: 50,
    },
    {
        key: "dictionary_100",
        name: "Lexicographer",
        description: "Add 100 dictionary entries across all languages",
        icon: "📖",
        tier: "SILVER",
        category: "DICTIONARY",
        threshold: 100,
    },
    {
        key: "dictionary_500",
        name: "Master Lexicographer",
        description: "Add 500 dictionary entries across all languages",
        icon: "📚",
        tier: "GOLD",
        category: "DICTIONARY",
        threshold: 500,
    },
    {
        key: "dictionary_1000",
        name: "Living Dictionary",
        description: "Add 1000 dictionary entries across all languages",
        icon: "🏆",
        tier: "PLATINUM",
        category: "DICTIONARY",
        threshold: 1000,
    },

    // Script/Alphabet Badges
    {
        key: "alphabet_complete",
        name: "Script Crafter",
        description: "Create a complete alphabet with 26 or more symbols",
        icon: "✍️",
        tier: "BRONZE",
        category: "SCRIPT",
        threshold: 26,
    },
    {
        key: "script_50",
        name: "Symbol Master",
        description: "Create 50 script symbols across all languages",
        icon: "🔤",
        tier: "SILVER",
        category: "SCRIPT",
        threshold: 50,
    },

    // Grammar Badges
    {
        key: "grammar_10",
        name: "Grammar Guide",
        description: "Create 10 grammar pages",
        icon: "📋",
        tier: "BRONZE",
        category: "GRAMMAR",
        threshold: 10,
    },
    {
        key: "grammar_50",
        name: "Grammar Master",
        description: "Create 50 grammar pages",
        icon: "🎓",
        tier: "SILVER",
        category: "GRAMMAR",
        threshold: 50,
    },
    {
        key: "paradigm_10",
        name: "Pattern Weaver",
        description: "Create 10 paradigm tables",
        icon: "📊",
        tier: "BRONZE",
        category: "GRAMMAR",
        threshold: 10,
    },

    // Social Badges
    {
        key: "followers_10",
        name: "Rising Star",
        description: "Gain 10 followers",
        icon: "⭐",
        tier: "BRONZE",
        category: "SOCIAL",
        threshold: 10,
    },
    {
        key: "followers_50",
        name: "Influencer",
        description: "Gain 50 followers",
        icon: "🌟",
        tier: "SILVER",
        category: "SOCIAL",
        threshold: 50,
    },
    {
        key: "followers_100",
        name: "Community Leader",
        description: "Gain 100 followers",
        icon: "👑",
        tier: "GOLD",
        category: "SOCIAL",
        threshold: 100,
    },
    {
        key: "favorites_10",
        name: "Well Liked",
        description: "Have your languages favorited 10 times",
        icon: "❤️",
        tier: "BRONZE",
        category: "SOCIAL",
        threshold: 10,
    },
    {
        key: "favorites_50",
        name: "Fan Favorite",
        description: "Have your languages favorited 50 times",
        icon: "💖",
        tier: "SILVER",
        category: "SOCIAL",
        threshold: 50,
    },

    // Content Badges
    {
        key: "article_5",
        name: "Storyteller",
        description: "Publish 5 articles",
        icon: "📰",
        tier: "BRONZE",
        category: "CONTENT",
        threshold: 5,
    },
    {
        key: "article_20",
        name: "Prolific Writer",
        description: "Publish 20 articles",
        icon: "✒️",
        tier: "SILVER",
        category: "CONTENT",
        threshold: 20,
    },
    {
        key: "text_10",
        name: "Author",
        description: "Create 10 texts",
        icon: "📕",
        tier: "BRONZE",
        category: "CONTENT",
        threshold: 10,
    },
    {
        key: "text_25",
        name: "Literary Master",
        description: "Create 25 texts",
        icon: "📚",
        tier: "SILVER",
        category: "CONTENT",
        threshold: 25,
    },
]

async function seedBadges() {
    console.log("🏅 Seeding badges...")

    for (const badge of badges) {
        await prisma.badge.upsert({
            where: { key: badge.key },
            update: {
                name: badge.name,
                description: badge.description,
                icon: badge.icon,
                tier: badge.tier,
                category: badge.category,
                threshold: badge.threshold,
            },
            create: {
                key: badge.key,
                name: badge.name,
                description: badge.description,
                icon: badge.icon,
                tier: badge.tier,
                category: badge.category,
                threshold: badge.threshold,
            },
        })
        console.log(`  ✓ ${badge.icon} ${badge.name}`)
    }

    console.log(`\n✅ Seeded ${badges.length} badges successfully!`)
}

seedBadges()
    .catch((e) => {
        console.error("Error seeding badges:", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
