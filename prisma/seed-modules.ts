import { PrismaClient, type ModuleType, type ModuleTier } from "@prisma/client"

const prisma = new PrismaClient()

type SeedModule = {
  slug: string
  name: string
  type: ModuleType
  tier: ModuleTier
  icon: string
  summary: string
  description: string
  permissions: string[]
  data?: unknown
}

const MODULES: SeedModule[] = [
  {
    slug: "classic-sound-changes",
    name: "Classic Sound Changes",
    type: "TRANSFORMER",
    tier: "DECLARATIVE",
    icon: "Workflow",
    summary: "A starter pack of common diachronic sound changes you can apply to your lexicon.",
    description:
      "# Classic Sound Changes\n\nA curated set of frequently-attested sound changes (lenition, final devoicing, palatalization) packaged as a reusable rule set.\n\nApply it to your dictionary to evolve your language a step further.",
    permissions: ["read:dictionary", "write:dictionary"],
    data: {
      rules: ["p → b / V_V", "k → tʃ / _i", "b → p / _#", "s → ∅ / V_V"].join("\n"),
    },
  },
  {
    slug: "vowel-space-chart",
    name: "Vowel Space Chart",
    type: "VISUALIZER",
    tier: "CLIENT_SANDBOX",
    icon: "ChartScatter",
    summary: "Plot your vowel inventory on an IPA vowel quadrilateral.",
    description:
      "# Vowel Space Chart\n\nReads your phonology and renders an interactive IPA vowel chart so you can see your language's vowel distribution at a glance.",
    permissions: ["read:phonology"],
  },
  {
    slug: "live-conjugator",
    name: "Paradigm Browser",
    type: "READER_WIDGET",
    tier: "CLIENT_SANDBOX",
    icon: "LayoutGrid",
    summary: "Browse your paradigm tables and see which words follow each inflection pattern.",
    description:
      "# Paradigm Browser\n\nShows your paradigm tables — select any paradigm to see its rows and columns with the stored inflected forms, plus the words assigned to it. Works on both the studio and your public language page.",
    permissions: ["read:paradigms"],
  },
  {
    slug: "anki-exporter",
    name: "Dictionary Exporter",
    type: "EXPORTER",
    tier: "CLIENT_SANDBOX",
    icon: "Download",
    summary: "Download your dictionary as an Anki deck (TSV), CSV, or JSON.",
    description:
      "# Dictionary Exporter\n\nTurns your lexicon into a downloadable file — choose **Anki (TSV)**, **CSV** for spreadsheets, or **JSON** for tooling. Toggle whether to include IPA and part of speech, preview the output, then download it in one click.",
    permissions: ["read:dictionary", "export"],
  },
  {
    slug: "phonotactics-linter",
    name: "Phonotactics Linter",
    type: "VALIDATOR",
    tier: "CLIENT_SANDBOX",
    icon: "BadgeCheck",
    summary: "Flags words that use characters outside your declared script.",
    description:
      "# Phonotactics Linter\n\nCross-checks every dictionary word against your declared script inventory (Alphabet). It lists words that contain off-inventory characters and shows which of your symbols are never used in the lexicon — a quick consistency pass for your orthography.",
    permissions: ["read:dictionary", "read:phonology"],
  },
  {
    slug: "lexicon-stats",
    name: "Lexicon Stats",
    type: "VISUALIZER",
    tier: "CLIENT_SANDBOX",
    icon: "BarChart3",
    summary: "A dashboard of your lexicon: size, parts of speech, IPA coverage.",
    description:
      "# Lexicon Stats\n\nAt-a-glance metrics for your dictionary — total words, distinct parts of speech, average word length, and IPA coverage — plus a bar chart of words by part of speech. Updates live as your lexicon grows.",
    permissions: ["read:dictionary"],
  },
  {
    slug: "swadesh-tracker",
    name: "Swadesh Tracker",
    type: "VISUALIZER",
    tier: "CLIENT_SANDBOX",
    icon: "Target",
    summary: "See how much of the core 100-word vocabulary your language covers.",
    description:
      "# Swadesh Tracker\n\nMeasures your lexicon against the Swadesh core-vocabulary list of ~100 universal concepts. Shows a coverage percentage, the concepts you've already coined, and the ones still missing — a focused to-do list for fleshing out a usable language.",
    permissions: ["read:dictionary"],
  },
  {
    slug: "script-gallery",
    name: "Script Gallery",
    type: "READER_WIDGET",
    tier: "CLIENT_SANDBOX",
    icon: "Type",
    summary: "Show off your writing system as a clean grid of symbols.",
    description:
      "# Script Gallery\n\nDisplays your language's script symbols in a tidy grid — each with its IPA value and Latin transliteration. A great showcase block for your public language page.",
    permissions: ["read:phonology"],
  },
  {
    slug: "parchment-theme",
    name: "Parchment Scroll",
    type: "THEME",
    tier: "DECLARATIVE",
    icon: "Palette",
    summary: "A warm, antique parchment palette for your public language page.",
    description:
      "# Parchment Scroll\n\nGives your public page a warm, old-manuscript feel — burnt-amber accents, soft cream background, and rounded corners. A declarative theme: it only changes colors, fonts, and shape, with no code execution.",
    permissions: [],
    data: {
      theme: {
        preset: "Parchment Scroll",
        primary: "#b45309",
        accent: "#0e7490",
        background: "#faf6ee",
        radius: "0.5rem",
        bodyFont: "Georgia, 'Times New Roman', serif",
        headingFont: "Georgia, 'Times New Roman', serif",
      },
    },
  },
  {
    slug: "random-word",
    name: "Random Word",
    type: "READER_WIDGET",
    tier: "CLIENT_SANDBOX",
    icon: "Dices",
    summary: "Show a random word from your lexicon — great for a language's home page.",
    description:
      "# Random Word\n\nPicks a random entry from your dictionary and displays the word, IPA pronunciation, definition, and part of speech. Each click reveals a new word. A simple but fun widget for your public language page.",
    permissions: ["read:dictionary"],
  },
  {
    slug: "phoneme-frequency",
    name: "Phoneme Frequency",
    type: "VISUALIZER",
    tier: "CLIENT_SANDBOX",
    icon: "BarChart2",
    summary: "A frequency chart of your alphabet symbols across all dictionary words.",
    description:
      "# Phoneme Frequency\n\nCounts how often each of your script symbols appears across every word in your dictionary, then displays a ranked bar chart. Useful for checking whether your phonology feels natural or if some sounds are over- or underused.",
    permissions: ["read:dictionary", "read:phonology"],
  },
  {
    slug: "grammar-index",
    name: "Grammar Index",
    type: "READER_WIDGET",
    tier: "CLIENT_SANDBOX",
    icon: "BookOpen",
    summary: "A clickable table of contents for your grammar pages, embedded on your public page.",
    description:
      "# Grammar Index\n\nLists all your published grammar sections as a linked table of contents. Each entry links directly to the full grammar page. A great way to surface your grammar to visitors right from your language's home page.",
    permissions: ["read:grammar"],
  },
  {
    slug: "midnight-neon-theme",
    name: "Midnight Neon",
    type: "THEME",
    tier: "DECLARATIVE",
    icon: "Palette",
    summary: "A bold dark theme with electric neon accents.",
    description:
      "# Midnight Neon\n\nA high-contrast palette with vivid violet and cyan accents on a deep background — great for sci-fi and futuristic conlangs.",
    permissions: [],
    data: {
      theme: {
        preset: "Midnight Neon",
        primary: "#7c3aed",
        accent: "#06b6d4",
        background: "#0b1020",
        radius: "1rem",
      },
    },
  },
]

async function main() {
  console.log("Seeding starter modules…")

  const author = await prisma.user.upsert({
    where: { email: "modules@lingocon.com" },
    update: {},
    create: { email: "modules@lingocon.com", name: "LingoCon" },
  })

  for (const m of MODULES) {
    const mod = await prisma.module.upsert({
      where: { slug: m.slug },
      update: {
        name: m.name,
        type: m.type,
        tier: m.tier,
        icon: m.icon,
        summary: m.summary,
        description: m.description,
        status: "PUBLISHED",
        isOfficial: true,
        license: "MIT",
        repoUrl: "https://github.com/alexcircuits/lingocon",
      },
      create: {
        slug: m.slug,
        name: m.name,
        type: m.type,
        tier: m.tier,
        icon: m.icon,
        summary: m.summary,
        description: m.description,
        status: "PUBLISHED",
        isOfficial: true,
        license: "MIT",
        repoUrl: "https://github.com/alexcircuits/lingocon",
        authorId: author.id,
      },
    })

    await prisma.moduleVersion.upsert({
      where: { moduleId_version: { moduleId: mod.id, version: "1.0.0" } },
      update: {
        permissions: m.permissions,
        data: (m.data ?? undefined) as never,
        publishedAt: new Date(),
      },
      create: {
        moduleId: mod.id,
        version: "1.0.0",
        manifest: { id: m.slug, version: "1.0.0", type: m.type, permissions: m.permissions } as never,
        permissions: m.permissions,
        sdkRange: "^1.0.0",
        changelog: "Initial release.",
        data: (m.data ?? undefined) as never,
        publishedAt: new Date(),
      },
    })

    console.log(`  ✓ ${m.name}`)
  }

  console.log("Done.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
