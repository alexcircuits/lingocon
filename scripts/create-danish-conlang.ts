import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Creating Danish-based conlang...")

  // Get or create dev user
  let devUser = await prisma.user.findFirst({
    where: { email: "dev@localhost" },
  })

  if (!devUser) {
    devUser = await prisma.user.create({
      data: {
        email: "dev@localhost",
        name: "Dev User",
      },
    })
    console.log("Created dev user:", devUser.email)
  } else {
    console.log("Found dev user:", devUser.email)
  }

  // Delete existing language if it exists (to start fresh)
  await prisma.language.deleteMany({
    where: { slug: "danskisk" },
  })

  // Create the language - Danskisk (Danish-based conlang)
  const language = await prisma.language.create({
    data: {
      name: "Danskisk",
      slug: "danskisk",
      description: "A constructed language based on Danish, featuring simplified grammar and expanded vocabulary. Danskisk preserves the melodic sound of Danish while making it more accessible to learners.",
      visibility: "PUBLIC",
      ownerId: devUser.id,
      flagUrl: "https://flagcdn.com/w320/dk.png",
      discordUrl: "https://discord.gg/danskisk",
      telegramUrl: "https://t.me/danskisk",
      websiteUrl: "https://danskisk.example.com",
      metadata: {
        wordOrder: "SVO",
        morphologicalTendency: "FUSIONAL",
        languageFamily: "Germanic",
        baseLanguage: "Danish",
      },
    },
  })

  console.log("Created language:", language.name)

  // Create script symbols (Danish alphabet with uppercase/lowercase)
  const danishAlphabet = [
    { symbol: "a", capitalSymbol: "A", ipa: "a", latin: "a", name: "a" },
    { symbol: "b", capitalSymbol: "B", ipa: "b", latin: "b", name: "be" },
    { symbol: "c", capitalSymbol: "C", ipa: "k", latin: "c", name: "ce" },
    { symbol: "d", capitalSymbol: "D", ipa: "d", latin: "d", name: "de" },
    { symbol: "e", capitalSymbol: "E", ipa: "e", latin: "e", name: "e" },
    { symbol: "f", capitalSymbol: "F", ipa: "f", latin: "f", name: "ef" },
    { symbol: "g", capitalSymbol: "G", ipa: "g", latin: "g", name: "ge" },
    { symbol: "h", capitalSymbol: "H", ipa: "h", latin: "h", name: "hå" },
    { symbol: "i", capitalSymbol: "I", ipa: "i", latin: "i", name: "i" },
    { symbol: "j", capitalSymbol: "J", ipa: "j", latin: "j", name: "jå" },
    { symbol: "k", capitalSymbol: "K", ipa: "k", latin: "k", name: "kå" },
    { symbol: "l", capitalSymbol: "L", ipa: "l", latin: "l", name: "el" },
    { symbol: "m", capitalSymbol: "M", ipa: "m", latin: "m", name: "em" },
    { symbol: "n", capitalSymbol: "N", ipa: "n", latin: "n", name: "en" },
    { symbol: "o", capitalSymbol: "O", ipa: "o", latin: "o", name: "o" },
    { symbol: "p", capitalSymbol: "P", ipa: "p", latin: "p", name: "pe" },
    { symbol: "q", capitalSymbol: "Q", ipa: "k", latin: "q", name: "ku" },
    { symbol: "r", capitalSymbol: "R", ipa: "ʁ", latin: "r", name: "er" },
    { symbol: "s", capitalSymbol: "S", ipa: "s", latin: "s", name: "es" },
    { symbol: "t", capitalSymbol: "T", ipa: "t", latin: "t", name: "te" },
    { symbol: "u", capitalSymbol: "U", ipa: "u", latin: "u", name: "u" },
    { symbol: "v", capitalSymbol: "V", ipa: "v", latin: "v", name: "ve" },
    { symbol: "w", capitalSymbol: "W", ipa: "v", latin: "w", name: "dobbelt-ve" },
    { symbol: "x", capitalSymbol: "X", ipa: "ks", latin: "x", name: "eks" },
    { symbol: "y", capitalSymbol: "Y", ipa: "y", latin: "y", name: "y" },
    { symbol: "z", capitalSymbol: "Z", ipa: "s", latin: "z", name: "zet" },
    { symbol: "æ", capitalSymbol: "Æ", ipa: "ɛ", latin: "ae", name: "æ" },
    { symbol: "ø", capitalSymbol: "Ø", ipa: "ø", latin: "oe", name: "ø" },
    { symbol: "å", capitalSymbol: "Å", ipa: "ɔ", latin: "aa", name: "å" },
  ]

  const symbols = await Promise.all(
    danishAlphabet.map((letter, index) =>
      prisma.scriptSymbol.create({
        data: {
          symbol: letter.symbol,
          capitalSymbol: letter.capitalSymbol,
          ipa: letter.ipa,
          latin: letter.latin,
          name: letter.name,
          order: index,
          languageId: language.id,
        },
      })
    )
  )

  console.log(`Created ${symbols.length} script symbols`)

  // Create dictionary entries
  const dictionaryEntries = [
    {
      lemma: "hej",
      gloss: "hello, hi",
      ipa: "hɑj",
      partOfSpeech: "interjection",
      etymology: "From Danish 'hej'",
      notes: "Common greeting, used in both formal and informal contexts",
    },
    {
      lemma: "verden",
      gloss: "world",
      ipa: "vɛʁdən",
      partOfSpeech: "noun",
      etymology: "From Danish 'verden'",
      notes: "Refers to the physical world or Earth",
    },
    {
      lemma: "sprog",
      gloss: "language",
      ipa: "spʁɔw",
      partOfSpeech: "noun",
      etymology: "From Danish 'sprog'",
      notes: "Can refer to any language, natural or constructed",
    },
    {
      lemma: "at være",
      gloss: "to be",
      ipa: "at vɛːə",
      partOfSpeech: "verb",
      etymology: "From Danish 'at være'",
      notes: "Irregular verb, essential for forming sentences",
    },
    {
      lemma: "og",
      gloss: "and",
      ipa: "ɔw",
      partOfSpeech: "conjunction",
      etymology: "From Danish 'og'",
      notes: "Used to connect words, phrases, or clauses",
    },
    {
      lemma: "jeg",
      gloss: "I",
      ipa: "jɑj",
      partOfSpeech: "pronoun",
      etymology: "From Danish 'jeg'",
      notes: "First person singular pronoun",
    },
    {
      lemma: "du",
      gloss: "you",
      ipa: "du",
      partOfSpeech: "pronoun",
      etymology: "From Danish 'du'",
      notes: "Second person singular pronoun, informal",
    },
    {
      lemma: "han",
      gloss: "he",
      ipa: "han",
      partOfSpeech: "pronoun",
      etymology: "From Danish 'han'",
      notes: "Third person masculine singular pronoun",
    },
    {
      lemma: "hun",
      gloss: "she",
      ipa: "hun",
      partOfSpeech: "pronoun",
      etymology: "From Danish 'hun'",
      notes: "Third person feminine singular pronoun",
    },
    {
      lemma: "vi",
      gloss: "we",
      ipa: "vi",
      partOfSpeech: "pronoun",
      etymology: "From Danish 'vi'",
      notes: "First person plural pronoun",
    },
    {
      lemma: "at elske",
      gloss: "to love",
      ipa: "at ɛlskə",
      partOfSpeech: "verb",
      etymology: "From Danish 'at elske'",
      notes: "Strong emotional attachment or affection",
    },
    {
      lemma: "hus",
      gloss: "house",
      ipa: "huːs",
      partOfSpeech: "noun",
      etymology: "From Danish 'hus'",
      notes: "A building where people live",
    },
    {
      lemma: "bog",
      gloss: "book",
      ipa: "bɔw",
      partOfSpeech: "noun",
      etymology: "From Danish 'bog'",
      notes: "A written or printed work",
    },
    {
      lemma: "vand",
      gloss: "water",
      ipa: "van",
      partOfSpeech: "noun",
      etymology: "From Danish 'vand'",
      notes: "Essential liquid for life",
    },
    {
      lemma: "sol",
      gloss: "sun",
      ipa: "sol",
      partOfSpeech: "noun",
      etymology: "From Danish 'sol'",
      notes: "The star at the center of our solar system",
    },
  ]

  const entries = await Promise.all(
    dictionaryEntries.map((entry) =>
      prisma.dictionaryEntry.create({
        data: {
          ...entry,
          languageId: language.id,
        },
      })
    )
  )

  console.log(`Created ${entries.length} dictionary entries`)

  // Create a paradigm (verb conjugation) - must be created before grammar pages that reference it
  const verbParadigm = await prisma.paradigm.create({
    data: {
      name: "Present Tense Conjugation",
      notes: "Regular verb conjugation pattern for present tense",
      languageId: language.id,
      slots: {
        rows: ["jeg", "du", "han/hun", "vi", "I", "de"],
        columns: ["at være (to be)", "at elske (to love)", "at bo (to live)"],
        cells: {
          "0-0": "er",
          "1-0": "er",
          "2-0": "er",
          "3-0": "er",
          "4-0": "er",
          "5-0": "er",
          "0-1": "elsker",
          "1-1": "elsker",
          "2-1": "elsker",
          "3-1": "elsker",
          "4-1": "elsker",
          "5-1": "elsker",
          "0-2": "bor",
          "1-2": "bor",
          "2-2": "bor",
          "3-2": "bor",
          "4-2": "bor",
          "5-2": "bor",
        },
      },
    },
  })

  console.log("Created paradigm:", verbParadigm.name)

  // Create grammar pages (one references the paradigm)
  const grammarPages = [
    {
      title: "Introduction to Danskisk",
      slug: "introduction",
      order: 0,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Introduction to Danskisk" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Danskisk is a constructed language (conlang) based on Danish. It preserves the melodic sound and many features of Danish while simplifying grammar and expanding vocabulary.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "History" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Danskisk was created in 2024 as an experiment in language construction. The goal was to create a language that would be easier to learn than Danish while maintaining its characteristic sound.",
              },
            ],
          },
        ],
      },
    },
    {
      title: "Phonology",
      slug: "phonology",
      order: 1,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Phonology" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Danskisk uses the same phoneme inventory as Danish, with 29 letters including the three special characters: æ, ø, and å.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Vowels" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Danskisk has 9 vowel phonemes: /a/, /e/, /i/, /o/, /u/, /y/, /ɛ/ (æ), /ø/, and /ɔ/ (å).",
              },
            ],
          },
        ],
      },
    },
    {
      title: "Grammar",
      slug: "grammar",
      order: 2,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Grammar" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Danskisk follows a Subject-Verb-Object (SVO) word order, similar to English and Danish. The language uses a fusional morphological system.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Verb Conjugation" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Verbs in Danskisk are conjugated based on tense and mood. The present tense is formed by adding the appropriate ending to the verb stem. Below is a conjugation table showing the present tense forms:",
              },
            ],
          },
          {
            type: "paradigm",
            attrs: {
              paradigmId: verbParadigm.id,
              paradigmName: verbParadigm.name,
            },
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "As you can see, Danskisk verbs are relatively simple - they don't change form based on the subject pronoun. This makes the language easier to learn than many other languages.",
              },
            ],
          },
        ],
      },
    },
  ]

  const createdGrammarPages = await Promise.all(
    grammarPages.map((page) =>
      prisma.grammarPage.create({
        data: {
          ...page,
          languageId: language.id,
        },
      })
    )
  )

  console.log(`Created ${createdGrammarPages.length} grammar pages`)

  // Create an article
  const article = await prisma.article.create({
    data: {
      title: "Welcome to Danskisk",
      excerpt: "An introduction to the Danskisk language community",
      slug: "welcome-to-danskisk",
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Welcome to Danskisk" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Welcome to the Danskisk language community! Danskisk is a constructed language based on Danish, designed to be more accessible while preserving the beautiful sound of Danish.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Why Danskisk?" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Danish is known for its challenging pronunciation and complex grammar. Danskisk simplifies these aspects while maintaining the melodic quality that makes Danish so appealing.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Getting Started" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Start by learning the alphabet and basic vocabulary. Then move on to grammar rules and practice with simple sentences. The community is here to help!",
              },
            ],
          },
        ],
      },
      published: true,
      publishedAt: new Date(),
      languageId: language.id,
      authorId: devUser.id,
    },
  })

  console.log("Created article:", article.title)

  // Create a text
  const text = await prisma.text.create({
    data: {
      title: "The Little Prince (Excerpt)",
      description: "An excerpt from 'The Little Prince' translated into Danskisk",
      slug: "the-little-prince-excerpt",
      type: "SHORT_STORY",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Jeg er fra planeten, hvor jeg bor. Det er en lille planet, og jeg elsker den meget. Der er en sol, der skinner hver dag, og jeg har en rose, som jeg passer på.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "En dag kom en lille prins til min planet. Han var meget lille og havde gyldent hår. Han fortalte mig om sin rejse gennem universet.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Vi blev venner, og jeg lærte meget af ham. Han lærte mig, at det vigtigste er usynligt for øjnene. Man ser kun godt med hjertet.",
              },
            ],
          },
        ],
      },
      languageId: language.id,
      authorId: devUser.id,
    },
  })

  console.log("Created text:", text.title)

  // Create activity entries
  await prisma.activity.createMany({
    data: [
      {
        type: "CREATED",
        entityType: "LANGUAGE",
        entityId: language.id,
        languageId: language.id,
        userId: devUser.id,
        description: `Created language "${language.name}"`,
      },
      {
        type: "CREATED",
        entityType: "DICTIONARY_ENTRY",
        entityId: entries[0].id,
        languageId: language.id,
        userId: devUser.id,
        description: `Added dictionary entry "${entries[0].lemma}"`,
      },
      {
        type: "CREATED",
        entityType: "GRAMMAR_PAGE",
        entityId: createdGrammarPages[0].id,
        languageId: language.id,
        userId: devUser.id,
        description: `Created grammar page "${createdGrammarPages[0].title}"`,
      },
    ],
  })

  console.log("Created activity entries")

  console.log("\n✅ Successfully created Danskisk conlang!")
  console.log(`\nLanguage: ${language.name}`)
  console.log(`Slug: ${language.slug}`)
  console.log(`Public URL: /lang/${language.slug}`)
  console.log(`Studio URL: /studio/lang/${language.slug}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

