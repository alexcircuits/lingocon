import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const SYSTEM_FAMILIES = [
  {
    name: "Proto-Indo-European",
    slug: "proto-indo-european",
    description:
      "Reconstructed ancestor of the Indo-European language family, including Germanic, Romance, Slavic, Indo-Iranian, Celtic, and many more branches.",
  },
  {
    name: "Proto-Afroasiatic",
    slug: "proto-afroasiatic",
    description:
      "Reconstructed ancestor of Semitic, Berber, Cushitic, Egyptian, Chadic, and Omotic languages.",
  },
  {
    name: "Proto-Turkic",
    slug: "proto-turkic",
    description:
      "Reconstructed ancestor of Turkish, Azerbaijani, Uzbek, Kazakh, Turkmen, and other Turkic languages.",
  },
  {
    name: "Proto-Sino-Tibetan",
    slug: "proto-sino-tibetan",
    description:
      "Reconstructed ancestor of Chinese, Tibetan, Burmese, and hundreds of other Sino-Tibetan languages.",
  },
  {
    name: "Proto-Austronesian",
    slug: "proto-austronesian",
    description:
      "Reconstructed ancestor of Malay, Indonesian, Tagalog, Maori, Hawaiian, Malagasy, and many Pacific/Southeast Asian languages.",
  },
  {
    name: "Proto-Dravidian",
    slug: "proto-dravidian",
    description:
      "Reconstructed ancestor of Tamil, Telugu, Kannada, Malayalam, and other Dravidian languages of South Asia.",
  },
  {
    name: "Proto-Uralic",
    slug: "proto-uralic",
    description:
      "Reconstructed ancestor of Finnish, Hungarian, Estonian, Sami, and other Uralic languages.",
  },
  {
    name: "Proto-Niger-Congo",
    slug: "proto-niger-congo",
    description:
      "Reconstructed ancestor of the world's largest language family by number of languages, including Bantu, Yoruba, Swahili, and Zulu.",
  },
  {
    name: "Proto-Japonic",
    slug: "proto-japonic",
    description:
      "Reconstructed ancestor of Japanese and Ryukyuan languages.",
  },
  {
    name: "Proto-Koreanic",
    slug: "proto-koreanic",
    description:
      "Reconstructed ancestor of Korean and Jeju languages.",
  },
  {
    name: "Proto-Mongolic",
    slug: "proto-mongolic",
    description:
      "Reconstructed ancestor of Mongolian, Buryat, Kalmyk, and other Mongolic languages.",
  },
  {
    name: "Proto-Tai-Kadai",
    slug: "proto-tai-kadai",
    description:
      "Reconstructed ancestor of Thai, Lao, Shan, Zhuang, and other Kra-Dai languages.",
  },
  {
    name: "Proto-Austroasiatic",
    slug: "proto-austroasiatic",
    description:
      "Reconstructed ancestor of Vietnamese, Khmer, Mon, and Munda languages.",
  },
  {
    name: "Proto-Nilo-Saharan",
    slug: "proto-nilo-saharan",
    description:
      "Proposed reconstructed ancestor of Nilotic, Saharan, Songhai, and other language groups across Africa.",
  },
  {
    name: "Proto-Kartvelian",
    slug: "proto-kartvelian",
    description:
      "Reconstructed ancestor of Georgian, Mingrelian, Svan, and Laz languages of the Caucasus.",
  },
  {
    name: "Proto-Quechuan",
    slug: "proto-quechuan",
    description:
      "Reconstructed ancestor of Quechua varieties spoken across the Andes in South America.",
  },
  {
    name: "Proto-Mayan",
    slug: "proto-mayan",
    description:
      "Reconstructed ancestor of Yucatec Maya, K'iche', Tzotzil, and other Mayan languages of Mesoamerica.",
  },
  {
    name: "Proto-Algonquian",
    slug: "proto-algonquian",
    description:
      "Reconstructed ancestor of Cree, Ojibwe, Blackfoot, Mi'kmaq, and other Algonquian languages of North America.",
  },
  {
    name: "Proto-Semitic",
    slug: "proto-semitic",
    description:
      "Reconstructed ancestor of Arabic, Hebrew, Amharic, Aramaic, and other Semitic languages (sub-branch of Afroasiatic).",
  },
  {
    name: "Proto-Tupian",
    slug: "proto-tupian",
    description:
      "Reconstructed ancestor of Guarani, Old Tupi, and other Tupian languages of South America.",
  },
]

// Sub-families: each entry references its parent by slug
const SUB_FAMILIES = [
  // Indo-European sub-families
  {
    name: "Proto-Germanic",
    slug: "proto-germanic",
    parentSlug: "proto-indo-european",
    description:
      "Reconstructed ancestor of English, German, Dutch, Swedish, Norwegian, Danish, Icelandic, and other Germanic languages.",
  },
  {
    name: "Proto-Italic",
    slug: "proto-italic",
    parentSlug: "proto-indo-european",
    description:
      "Reconstructed ancestor of Latin, Oscan, Umbrian, and through Latin, all Romance languages.",
  },
  {
    name: "Proto-Slavic",
    slug: "proto-slavic",
    parentSlug: "proto-indo-european",
    description:
      "Reconstructed ancestor of Russian, Polish, Czech, Serbian, Bulgarian, Ukrainian, and other Slavic languages.",
  },
  {
    name: "Proto-Celtic",
    slug: "proto-celtic",
    parentSlug: "proto-indo-european",
    description:
      "Reconstructed ancestor of Irish, Welsh, Breton, Scottish Gaelic, and other Celtic languages.",
  },
  {
    name: "Proto-Indo-Iranian",
    slug: "proto-indo-iranian",
    parentSlug: "proto-indo-european",
    description:
      "Reconstructed ancestor of Sanskrit, Persian, Hindi, Urdu, Bengali, Kurdish, Pashto, and other Indo-Iranian languages.",
  },
  {
    name: "Proto-Hellenic",
    slug: "proto-hellenic",
    parentSlug: "proto-indo-european",
    description:
      "Reconstructed ancestor of Ancient Greek, Modern Greek, and other Hellenic varieties.",
  },
  {
    name: "Proto-Baltic",
    slug: "proto-baltic",
    parentSlug: "proto-indo-european",
    description:
      "Reconstructed ancestor of Lithuanian, Latvian, and the extinct Old Prussian language.",
  },

  // Niger-Congo sub-family
  {
    name: "Proto-Bantu",
    slug: "proto-bantu",
    parentSlug: "proto-niger-congo",
    description:
      "Reconstructed ancestor of Swahili, Zulu, Xhosa, Shona, Lingala, and hundreds of other Bantu languages.",
  },

  // Austronesian sub-families
  {
    name: "Proto-Malayo-Polynesian",
    slug: "proto-malayo-polynesian",
    parentSlug: "proto-austronesian",
    description:
      "Reconstructed ancestor of Malay, Indonesian, Tagalog, Hawaiian, Maori, Samoan, and most Austronesian languages.",
  },
  {
    name: "Proto-Oceanic",
    slug: "proto-oceanic",
    parentSlug: "proto-austronesian",
    description:
      "Reconstructed ancestor of Fijian, Tongan, Hawaiian, Maori, and other Oceanic languages of the Pacific.",
  },

  // Sino-Tibetan sub-families
  {
    name: "Proto-Sinitic",
    slug: "proto-sinitic",
    parentSlug: "proto-sino-tibetan",
    description:
      "Reconstructed ancestor of Mandarin, Cantonese, Wu, Min, Hakka, and other Chinese language varieties.",
  },
  {
    name: "Proto-Tibeto-Burman",
    slug: "proto-tibeto-burman",
    parentSlug: "proto-sino-tibetan",
    description:
      "Reconstructed ancestor of Tibetan, Burmese, Newari, Bodo, and hundreds of other Tibeto-Burman languages.",
  },
]

async function main() {
  console.log("Seeding system language families...")

  // Find or create a system user for ownership
  let systemUser = await prisma.user.findFirst({
    where: { email: "system@lingocon.app" },
  })

  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: "system@lingocon.app",
        name: "LingoCon",
      },
    })
    console.log("Created system user:", systemUser.email)
  }

  // --- Seed top-level families ---
  let created = 0
  let skipped = 0

  for (const family of SYSTEM_FAMILIES) {
    const existing = await prisma.languageFamily.findUnique({
      where: { slug: family.slug },
    })

    if (existing) {
      // Update to SYSTEM type if it exists but isn't marked as such
      await prisma.languageFamily.update({
        where: { slug: family.slug },
        data: {
          type: "SYSTEM",
          visibility: "PUBLIC",
          description: family.description,
        },
      })
      skipped++
      continue
    }

    await prisma.languageFamily.create({
      data: {
        name: family.name,
        slug: family.slug,
        description: family.description,
        visibility: "PUBLIC",
        type: "SYSTEM",
        ownerId: systemUser.id,
      },
    })
    created++
  }

  console.log(`Created ${created} system families, updated ${skipped} existing`)

  // --- Seed sub-families ---
  console.log("\nSeeding sub-families...")
  let subCreated = 0
  let subSkipped = 0
  let subLinked = 0

  for (const sub of SUB_FAMILIES) {
    // Find the parent family
    const parentFamily = await prisma.languageFamily.findUnique({
      where: { slug: sub.parentSlug },
    })
    if (!parentFamily) {
      console.warn(`  ⚠ Parent "${sub.parentSlug}" not found for "${sub.name}", skipping`)
      continue
    }

    const existing = await prisma.languageFamily.findUnique({
      where: { slug: sub.slug },
    })

    if (existing) {
      // If it exists but isn't linked to its parent, link it
      if (!existing.parentFamilyId) {
        await prisma.languageFamily.update({
          where: { slug: sub.slug },
          data: {
            parentFamilyId: parentFamily.id,
            type: "SYSTEM",
            visibility: "PUBLIC",
            description: sub.description,
          },
        })
        subLinked++
        console.log(`  ✓ Linked existing "${sub.name}" under "${parentFamily.name}"`)
      } else {
        // Already exists and already linked, just update metadata
        await prisma.languageFamily.update({
          where: { slug: sub.slug },
          data: {
            type: "SYSTEM",
            visibility: "PUBLIC",
            description: sub.description,
          },
        })
        subSkipped++
      }
      continue
    }

    await prisma.languageFamily.create({
      data: {
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        visibility: "PUBLIC",
        type: "SYSTEM",
        ownerId: systemUser.id,
        parentFamilyId: parentFamily.id,
      },
    })
    subCreated++
    console.log(`  + Created "${sub.name}" under "${parentFamily.name}"`)
  }

  console.log(`Sub-families: ${subCreated} created, ${subLinked} linked, ${subSkipped} already existed`)

  // Migrate existing externalAncestry values to matching LanguageFamily records
  console.log("\nMigrating externalAncestry values...")

  const languagesWithAncestry = await prisma.language.findMany({
    where: {
      externalAncestry: { not: null },
      familyId: null,
    },
    select: {
      id: true,
      externalAncestry: true,
    },
  })

  let migrated = 0
  for (const lang of languagesWithAncestry) {
    if (!lang.externalAncestry) continue

    // Try to find a matching system family
    const matchingFamily = await prisma.languageFamily.findFirst({
      where: {
        type: "SYSTEM",
        name: { equals: lang.externalAncestry, mode: "insensitive" },
      },
    })

    if (matchingFamily) {
      await prisma.language.update({
        where: { id: lang.id },
        data: { familyId: matchingFamily.id },
      })
      migrated++
    }
  }

  console.log(`Migrated ${migrated} languages to system families`)
  console.log("Done!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
