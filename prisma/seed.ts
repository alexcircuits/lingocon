import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create a test user
  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      name: "Test User",
    },
  })

  console.log("Created user:", user.email)

  // Create a test language
  const language = await prisma.language.upsert({
    where: { slug: "test-language" },
    update: {},
    create: {
      name: "Test Language",
      slug: "test-language",
      description: "A sample constructed language for testing",
      visibility: "PUBLIC",
      ownerId: user.id,
    },
  })

  console.log("Created language:", language.name)

  // Create some script symbols
  const symbols = await Promise.all([
    prisma.scriptSymbol.create({
      data: {
        symbol: "a",
        ipa: "a",
        name: "Letter A",
        order: 0,
        languageId: language.id,
      },
    }),
    prisma.scriptSymbol.create({
      data: {
        symbol: "b",
        ipa: "b",
        name: "Letter B",
        order: 1,
        languageId: language.id,
      },
    }),
    prisma.scriptSymbol.create({
      data: {
        symbol: "c",
        ipa: "k",
        name: "Letter C",
        order: 2,
        languageId: language.id,
      },
    }),
  ])

  console.log(`Created ${symbols.length} script symbols`)

  // Create a grammar page
  const grammarPage = await prisma.grammarPage.create({
    data: {
      title: "Introduction",
      slug: "introduction",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Introduction" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "This is a sample grammar page.",
              },
            ],
          },
        ],
      },
      order: 0,
      languageId: language.id,
    },
  })

  console.log("Created grammar page:", grammarPage.title)

  // Create some dictionary entries
  const entries = await Promise.all([
    prisma.dictionaryEntry.create({
      data: {
        lemma: "hello",
        gloss: "greeting",
        ipa: "hɛloʊ",
        partOfSpeech: "interjection",
        languageId: language.id,
      },
    }),
    prisma.dictionaryEntry.create({
      data: {
        lemma: "world",
        gloss: "planet Earth",
        ipa: "wɜrld",
        partOfSpeech: "noun",
        languageId: language.id,
      },
    }),
  ])

  console.log(`Created ${entries.length} dictionary entries`)

  console.log("Seeding completed!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

