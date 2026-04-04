import { prisma } from "@/lib/prisma"
import {
  findRootId,
  getDescendantIds,
  hasCircularReference,
} from "@/lib/utils/family-graph"
import { UnauthorizedError, NotFoundError, ValidationError, ConflictError } from "@/lib/errors"

// ─── Parent Language ────────────────────────────────────────────────────────

export async function setParentLanguage(
  languageId: string,
  parentLanguageId: string | null,
  userId: string
) {
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { ownerId: true },
  })

  if (!language || language.ownerId !== userId) {
    throw new UnauthorizedError()
  }

  if (parentLanguageId) {
    const parentLanguage = await prisma.language.findUnique({
      where: { id: parentLanguageId },
      select: { ownerId: true, visibility: true },
    })

    if (!parentLanguage) {
      throw new NotFoundError("Parent language")
    }

    if (parentLanguage.ownerId !== userId && parentLanguage.visibility !== "PUBLIC") {
      throw new UnauthorizedError("Can only set a public language or your own language as parent")
    }

    const isCircular = await hasCircularReference(languageId, parentLanguageId)
    if (isCircular) {
      throw new ConflictError("Cannot create circular family tree")
    }
  }

  await prisma.language.update({
    where: { id: languageId },
    data: { parentLanguageId },
  })
}

export async function setExternalAncestry(
  languageId: string,
  externalAncestry: string | null,
  userId: string
) {
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { ownerId: true },
  })

  if (!language || language.ownerId !== userId) {
    throw new UnauthorizedError()
  }

  await prisma.language.update({
    where: { id: languageId },
    data: { externalAncestry: externalAncestry?.trim() || null },
  })
}

// ─── Family Tree ────────────────────────────────────────────────────────────

export async function buildFamilyTree(languageId: string) {
  const rootId = await findRootId(languageId)

  const childSelect = {
    id: true,
    name: true,
    slug: true,
    visibility: true,
    externalAncestry: true,
    owner: { select: { id: true, name: true, image: true } },
    _count: { select: { dictionaryEntries: true } },
  } as const

  const childInclude = (depth: number): any => {
    if (depth <= 0) return { select: childSelect }
    return {
      select: {
        ...childSelect,
        childLanguages: childInclude(depth - 1),
      },
    }
  }

  const rootTree = await prisma.language.findUnique({
    where: { id: rootId },
    select: {
      ...childSelect,
      childLanguages: childInclude(10),
    },
  })

  if (!rootTree) return null

  if (rootTree.externalAncestry) {
    const siblingRoots = await prisma.language.findMany({
      where: {
        externalAncestry: rootTree.externalAncestry,
        parentLanguageId: null,
        id: { not: rootId },
      },
      select: {
        ...childSelect,
        childLanguages: childInclude(5),
      },
      take: 50,
    })

    if (siblingRoots.length > 0) {
      const safeId = encodeURIComponent(rootTree.externalAncestry)
      return {
        id: `virtual-${safeId}`,
        name: rootTree.externalAncestry,
        slug: "",
        externalAncestry: rootTree.externalAncestry,
        isVirtual: true,
        childLanguages: [rootTree, ...siblingRoots],
      } as any
    }
  }

  return rootTree
}

// ─── Family CRUD ────────────────────────────────────────────────────────────

async function generateFamilySlug(name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  let slug = base
  let counter = 1
  while (await prisma.languageFamily.findUnique({ where: { slug } })) {
    slug = `${base}-${counter}`
    counter++
  }
  return slug
}

export async function createFamily(
  data: {
    name: string
    description?: string
    visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC"
    parentFamilyId?: string
  },
  userId: string
) {
  if (data.parentFamilyId) {
    const parentFamily = await prisma.languageFamily.findUnique({
      where: { id: data.parentFamilyId },
      select: { id: true, ownerId: true, visibility: true, type: true },
    })
    if (!parentFamily) throw new NotFoundError("Parent family")
    if (parentFamily.ownerId !== userId && parentFamily.visibility !== "PUBLIC" && parentFamily.type !== "SYSTEM") {
      throw new UnauthorizedError("Cannot create sub-family under a private family you don't own")
    }
  }

  const slug = await generateFamilySlug(data.name)
  return prisma.languageFamily.create({
    data: {
      name: data.name.trim(),
      slug,
      description: data.description?.trim() || null,
      visibility: data.visibility || "PRIVATE",
      ownerId: userId,
      parentFamilyId: data.parentFamilyId || null,
    },
  })
}

export async function updateFamily(
  familyId: string,
  data: { name?: string; description?: string; visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC" },
  userId: string
) {
  const family = await prisma.languageFamily.findUnique({
    where: { id: familyId },
    select: { ownerId: true },
  })
  if (!family || family.ownerId !== userId) throw new UnauthorizedError()

  await prisma.languageFamily.update({
    where: { id: familyId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description.trim() || null }),
      ...(data.visibility !== undefined && { visibility: data.visibility }),
    },
  })
}

export async function deleteFamily(familyId: string, userId: string) {
  const family = await prisma.languageFamily.findUnique({
    where: { id: familyId },
    select: { ownerId: true, type: true },
  })
  if (!family || family.ownerId !== userId) throw new UnauthorizedError()
  if (family.type === "SYSTEM") throw new ValidationError("Cannot delete system families")

  await prisma.languageFamily.delete({ where: { id: familyId } })
}

export async function setLanguageFamily(
  languageId: string,
  familyId: string | null,
  userId: string
) {
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { ownerId: true },
  })
  if (!language || language.ownerId !== userId) throw new UnauthorizedError()

  if (familyId) {
    const family = await prisma.languageFamily.findUnique({
      where: { id: familyId },
      select: { ownerId: true, visibility: true },
    })
    if (!family) throw new NotFoundError("Family")
    if (family.ownerId !== userId && family.visibility !== "PUBLIC") {
      throw new UnauthorizedError("Can only join your own families or public families")
    }
  }

  await prisma.language.update({
    where: { id: languageId },
    data: { familyId },
  })
}

// ─── Query Functions ────────────────────────────────────────────────────────

export async function getUserFamilies(userId: string) {
  return prisma.languageFamily.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      visibility: true,
      type: true,
      _count: { select: { languages: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function searchFamilies(query: string, userId: string) {
  const baseWhere = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { slug: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {}

  const selectFields = {
    id: true,
    name: true,
    slug: true,
    description: true,
    type: true,
    parentFamilyId: true,
    owner: { select: { name: true } },
    _count: { select: { languages: true } },
  }

  const [system, own, publicFamilies] = await Promise.all([
    prisma.languageFamily.findMany({
      where: { ...baseWhere, type: "SYSTEM" },
      select: selectFields,
      take: 30,
      orderBy: { name: "asc" },
    }),
    prisma.languageFamily.findMany({
      where: { ...baseWhere, ownerId: userId, type: "USER" },
      select: selectFields,
      take: 20,
      orderBy: { name: "asc" },
    }),
    prisma.languageFamily.findMany({
      where: { ...baseWhere, ownerId: { not: userId }, visibility: "PUBLIC", type: "USER" },
      select: selectFields,
      take: 20,
      orderBy: { name: "asc" },
    }),
  ])

  return { system, own, public: publicFamilies }
}

export async function searchParentLanguages(
  languageId: string,
  query: string,
  userId: string
) {
  const descendantIdList = await getDescendantIds(languageId)
  const excludeIds = [languageId, ...descendantIdList]

  const baseWhere = {
    id: { notIn: excludeIds },
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { slug: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const selectFields = {
    id: true,
    name: true,
    slug: true,
    owner: { select: { name: true } },
  }

  const [own, publicLangs] = await Promise.all([
    prisma.language.findMany({
      where: { ...baseWhere, ownerId: userId },
      select: selectFields,
      take: 20,
      orderBy: { name: "asc" },
    }),
    prisma.language.findMany({
      where: { ...baseWhere, ownerId: { not: userId }, visibility: "PUBLIC" },
      select: selectFields,
      take: 20,
      orderBy: { name: "asc" },
    }),
  ])

  return { own, public: publicLangs }
}

export async function getExternalAncestries(): Promise<string[]> {
  const result = await prisma.language.findMany({
    where: { externalAncestry: { not: null } },
    select: { externalAncestry: true },
    distinct: ["externalAncestry"],
    orderBy: { externalAncestry: "asc" },
  })
  return result.map((r) => r.externalAncestry).filter((v): v is string => v !== null)
}

// ─── Family Hierarchy ───────────────────────────────────────────────────────

export async function getFamilyAncestryPath(familyId: string) {
  const path: { id: string; name: string; slug: string }[] = []
  let currentId: string | null = familyId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const family: { id: string; name: string; slug: string; parentFamilyId: string | null } | null =
      await prisma.languageFamily.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, slug: true, parentFamilyId: true },
      })
    if (!family) break
    path.unshift({ id: family.id, name: family.name, slug: family.slug })
    currentId = family.parentFamilyId
  }

  return path
}

export async function getFamilyChildren(familyId: string) {
  return prisma.languageFamily.findMany({
    where: { parentFamilyId: familyId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      type: true,
      visibility: true,
      _count: { select: { languages: true, childFamilies: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function setFamilyParent(
  familyId: string,
  parentFamilyId: string | null,
  userId: string
) {
  const family = await prisma.languageFamily.findUnique({
    where: { id: familyId },
    select: { ownerId: true, type: true },
  })
  if (!family || family.ownerId !== userId) throw new UnauthorizedError()
  if (family.type === "SYSTEM") throw new ValidationError("Cannot modify system families")

  if (parentFamilyId) {
    if (familyId === parentFamilyId) throw new ConflictError("Cannot set family as its own parent")

    const parent = await prisma.languageFamily.findUnique({
      where: { id: parentFamilyId },
      select: { id: true, ownerId: true, visibility: true, type: true },
    })
    if (!parent) throw new NotFoundError("Parent family")
    if (parent.ownerId !== userId && parent.visibility !== "PUBLIC" && parent.type !== "SYSTEM") {
      throw new UnauthorizedError("Cannot link to a private family you don't own")
    }

    // Prevent circular reference
    let currentId: string | null = parentFamilyId
    const visited = new Set<string>()
    while (currentId && !visited.has(currentId)) {
      if (currentId === familyId) throw new ConflictError("Cannot create circular family hierarchy")
      visited.add(currentId)
      const f: { parentFamilyId: string | null } | null = await prisma.languageFamily.findUnique({
        where: { id: currentId },
        select: { parentFamilyId: true },
      })
      currentId = f?.parentFamilyId || null
    }
  }

  await prisma.languageFamily.update({
    where: { id: familyId },
    data: { parentFamilyId },
  })
}

// ─── Proto-Vocabulary ───────────────────────────────────────────────────────

export async function createProtoWord(
  familyId: string,
  data: { lemma: string; gloss: string; ipa?: string; notes?: string },
  userId: string
) {
  const family = await prisma.languageFamily.findUnique({
    where: { id: familyId },
    select: { ownerId: true, type: true },
  })
  if (!family) throw new NotFoundError("Family")
  if (family.type === "SYSTEM") throw new ValidationError("Cannot add proto-words to system families")
  if (family.ownerId !== userId) throw new UnauthorizedError()

  return prisma.protoWord.create({
    data: {
      lemma: data.lemma.trim(),
      gloss: data.gloss.trim(),
      ipa: data.ipa?.trim() || null,
      notes: data.notes?.trim() || null,
      familyId,
    },
  })
}

export async function deleteProtoWord(protoWordId: string, userId: string) {
  const word = await prisma.protoWord.findUnique({
    where: { id: protoWordId },
    select: { family: { select: { ownerId: true, type: true } } },
  })
  if (!word) throw new NotFoundError("Proto-word")
  if (word.family.type === "SYSTEM") throw new ValidationError("Cannot delete system proto-words")
  if (word.family.ownerId !== userId) throw new UnauthorizedError()

  await prisma.protoWord.delete({ where: { id: protoWordId } })
}

export async function getProtoVocabulary(
  familyId: string,
  query: string,
  page: number = 1,
  pageSize: number = 50
) {
  const where = {
    familyId,
    ...(query
      ? {
          OR: [
            { lemma: { contains: query, mode: "insensitive" as const } },
            { gloss: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [words, total] = await Promise.all([
    prisma.protoWord.findMany({
      where,
      select: { id: true, lemma: true, gloss: true, ipa: true, notes: true },
      orderBy: { lemma: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.protoWord.count({ where }),
  ])

  return { words, total }
}

// ─── Word Derivation ────────────────────────────────────────────────────────

export async function deriveWords(
  sourceLanguageId: string,
  targetLanguageId: string,
  entryIds: string[],
  userId: string
) {
  if (entryIds.length === 0) throw new ValidationError("No entries selected")
  if (entryIds.length > 100) throw new ValidationError("Maximum 100 entries at a time")

  const targetLang = await prisma.language.findUnique({
    where: { id: targetLanguageId },
    select: { ownerId: true },
  })
  if (!targetLang || targetLang.ownerId !== userId) {
    throw new UnauthorizedError("Unauthorized to modify target language")
  }

  const [sourceEntries, sourceLang] = await Promise.all([
    prisma.dictionaryEntry.findMany({
      where: { id: { in: entryIds }, languageId: sourceLanguageId },
      select: { id: true, lemma: true, gloss: true, ipa: true, partOfSpeech: true, tags: true },
    }),
    prisma.language.findUnique({
      where: { id: sourceLanguageId },
      select: { name: true },
    }),
  ])

  if (sourceEntries.length === 0) throw new NotFoundError("No valid source entries found")

  const created = await prisma.dictionaryEntry.createMany({
    data: sourceEntries.map((entry) => ({
      lemma: entry.lemma,
      gloss: entry.gloss,
      ipa: entry.ipa,
      partOfSpeech: entry.partOfSpeech,
      tags: entry.tags === null ? undefined : (entry.tags as any),
      etymology: `From ${sourceLang?.name || "parent language"}: ${entry.lemma}`,
      sourceEntryId: entry.id,
      languageId: targetLanguageId,
    })),
  })

  return { count: created.count }
}

export async function getLanguageDictionary(
  languageId: string,
  query: string,
  userId: string,
  page: number = 1,
  pageSize: number = 50
) {
  const lang = await prisma.language.findUnique({
    where: { id: languageId },
    select: { ownerId: true, visibility: true },
  })
  if (!lang) return { entries: [], total: 0 }
  if (lang.ownerId !== userId && lang.visibility !== "PUBLIC") {
    return { entries: [], total: 0 }
  }

  const where = {
    languageId,
    ...(query
      ? {
          OR: [
            { lemma: { contains: query, mode: "insensitive" as const } },
            { gloss: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [entries, total] = await Promise.all([
    prisma.dictionaryEntry.findMany({
      where,
      select: { id: true, lemma: true, gloss: true, ipa: true, partOfSpeech: true, tags: true },
      orderBy: { lemma: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dictionaryEntry.count({ where }),
  ])

  return { entries, total }
}

export async function deriveFromProto(
  protoWordIds: string[],
  targetLanguageId: string,
  userId: string
) {
  if (protoWordIds.length === 0) throw new ValidationError("No proto-words selected")
  if (protoWordIds.length > 100) throw new ValidationError("Maximum 100 proto-words at a time")

  const targetLang = await prisma.language.findUnique({
    where: { id: targetLanguageId },
    select: { ownerId: true },
  })
  if (!targetLang || targetLang.ownerId !== userId) {
    throw new UnauthorizedError("Unauthorized to modify target language")
  }

  const protoWords = await prisma.protoWord.findMany({
    where: { id: { in: protoWordIds } },
    select: {
      id: true,
      lemma: true,
      gloss: true,
      ipa: true,
      family: { select: { name: true } },
    },
  })

  if (protoWords.length === 0) throw new NotFoundError("No valid proto-words found")

  const created = await prisma.dictionaryEntry.createMany({
    data: protoWords.map((pw) => ({
      lemma: pw.lemma.replace(/^\*/, ""),
      gloss: pw.gloss,
      ipa: pw.ipa,
      etymology: `From ${pw.family.name}: ${pw.lemma}`,
      protoSourceId: pw.id,
      languageId: targetLanguageId,
    })),
  })

  return { count: created.count }
}
