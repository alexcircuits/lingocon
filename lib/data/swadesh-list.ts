/**
 * Swadesh 207-word list — the standard basic vocabulary list
 * used by linguists to compare languages and track completeness.
 *
 * Words are grouped by semantic category for UI grouping.
 */

export interface SwadeshConcept {
  id: number
  english: string
  category: string
}

export const SWADESH_CATEGORIES = [
  "Pronouns",
  "Body",
  "Nature",
  "Animals",
  "Colors",
  "Numbers",
  "Actions",
  "Descriptors",
  "Spatial",
  "Other",
] as const

export const SWADESH_LIST: SwadeshConcept[] = [
  // Pronouns
  { id: 1, english: "I", category: "Pronouns" },
  { id: 2, english: "you (singular)", category: "Pronouns" },
  { id: 3, english: "he", category: "Pronouns" },
  { id: 4, english: "we", category: "Pronouns" },
  { id: 5, english: "you (plural)", category: "Pronouns" },
  { id: 6, english: "they", category: "Pronouns" },
  { id: 7, english: "this", category: "Pronouns" },
  { id: 8, english: "that", category: "Pronouns" },
  { id: 9, english: "who", category: "Pronouns" },
  { id: 10, english: "what", category: "Pronouns" },

  // Body
  { id: 11, english: "head", category: "Body" },
  { id: 12, english: "hair", category: "Body" },
  { id: 13, english: "eye", category: "Body" },
  { id: 14, english: "ear", category: "Body" },
  { id: 15, english: "nose", category: "Body" },
  { id: 16, english: "mouth", category: "Body" },
  { id: 17, english: "tooth", category: "Body" },
  { id: 18, english: "tongue", category: "Body" },
  { id: 19, english: "neck", category: "Body" },
  { id: 20, english: "hand", category: "Body" },
  { id: 21, english: "foot", category: "Body" },
  { id: 22, english: "knee", category: "Body" },
  { id: 23, english: "belly", category: "Body" },
  { id: 24, english: "breast", category: "Body" },
  { id: 25, english: "back", category: "Body" },
  { id: 26, english: "arm", category: "Body" },
  { id: 27, english: "leg", category: "Body" },
  { id: 28, english: "skin", category: "Body" },
  { id: 29, english: "bone", category: "Body" },
  { id: 30, english: "blood", category: "Body" },
  { id: 31, english: "heart", category: "Body" },
  { id: 32, english: "liver", category: "Body" },
  { id: 33, english: "nail", category: "Body" },
  { id: 34, english: "horn", category: "Body" },
  { id: 35, english: "tail", category: "Body" },
  { id: 36, english: "feather", category: "Body" },
  { id: 37, english: "egg", category: "Body" },

  // Nature
  { id: 38, english: "water", category: "Nature" },
  { id: 39, english: "fire", category: "Nature" },
  { id: 40, english: "earth", category: "Nature" },
  { id: 41, english: "stone", category: "Nature" },
  { id: 42, english: "sand", category: "Nature" },
  { id: 43, english: "mountain", category: "Nature" },
  { id: 44, english: "river", category: "Nature" },
  { id: 45, english: "lake", category: "Nature" },
  { id: 46, english: "sea", category: "Nature" },
  { id: 47, english: "salt", category: "Nature" },
  { id: 48, english: "rain", category: "Nature" },
  { id: 49, english: "snow", category: "Nature" },
  { id: 50, english: "ice", category: "Nature" },
  { id: 51, english: "smoke", category: "Nature" },
  { id: 52, english: "ash", category: "Nature" },
  { id: 53, english: "cloud", category: "Nature" },
  { id: 54, english: "fog", category: "Nature" },
  { id: 55, english: "sky", category: "Nature" },
  { id: 56, english: "wind", category: "Nature" },
  { id: 57, english: "sun", category: "Nature" },
  { id: 58, english: "moon", category: "Nature" },
  { id: 59, english: "star", category: "Nature" },
  { id: 60, english: "tree", category: "Nature" },
  { id: 61, english: "flower", category: "Nature" },
  { id: 62, english: "grass", category: "Nature" },
  { id: 63, english: "root", category: "Nature" },
  { id: 64, english: "bark", category: "Nature" },
  { id: 65, english: "leaf", category: "Nature" },
  { id: 66, english: "seed", category: "Nature" },
  { id: 67, english: "forest", category: "Nature" },
  { id: 68, english: "path", category: "Nature" },
  { id: 69, english: "dust", category: "Nature" },
  { id: 70, english: "mud", category: "Nature" },

  // Animals
  { id: 71, english: "dog", category: "Animals" },
  { id: 72, english: "fish", category: "Animals" },
  { id: 73, english: "bird", category: "Animals" },
  { id: 74, english: "louse", category: "Animals" },
  { id: 75, english: "snake", category: "Animals" },
  { id: 76, english: "worm", category: "Animals" },
  { id: 77, english: "fly", category: "Animals" },
  { id: 78, english: "animal", category: "Animals" },

  // Colors
  { id: 79, english: "red", category: "Colors" },
  { id: 80, english: "green", category: "Colors" },
  { id: 81, english: "yellow", category: "Colors" },
  { id: 82, english: "white", category: "Colors" },
  { id: 83, english: "black", category: "Colors" },

  // Numbers
  { id: 84, english: "one", category: "Numbers" },
  { id: 85, english: "two", category: "Numbers" },
  { id: 86, english: "three", category: "Numbers" },
  { id: 87, english: "four", category: "Numbers" },
  { id: 88, english: "five", category: "Numbers" },
  { id: 89, english: "many", category: "Numbers" },
  { id: 90, english: "all", category: "Numbers" },
  { id: 91, english: "few", category: "Numbers" },
  { id: 92, english: "other", category: "Numbers" },

  // Actions / Verbs
  { id: 93, english: "eat", category: "Actions" },
  { id: 94, english: "drink", category: "Actions" },
  { id: 95, english: "bite", category: "Actions" },
  { id: 96, english: "suck", category: "Actions" },
  { id: 97, english: "spit", category: "Actions" },
  { id: 98, english: "vomit", category: "Actions" },
  { id: 99, english: "blow", category: "Actions" },
  { id: 100, english: "breathe", category: "Actions" },
  { id: 101, english: "laugh", category: "Actions" },
  { id: 102, english: "cry", category: "Actions" },
  { id: 103, english: "see", category: "Actions" },
  { id: 104, english: "hear", category: "Actions" },
  { id: 105, english: "know", category: "Actions" },
  { id: 106, english: "think", category: "Actions" },
  { id: 107, english: "smell", category: "Actions" },
  { id: 108, english: "fear", category: "Actions" },
  { id: 109, english: "sleep", category: "Actions" },
  { id: 110, english: "die", category: "Actions" },
  { id: 111, english: "live", category: "Actions" },
  { id: 112, english: "kill", category: "Actions" },
  { id: 113, english: "fight", category: "Actions" },
  { id: 114, english: "hunt", category: "Actions" },
  { id: 115, english: "hit", category: "Actions" },
  { id: 116, english: "cut", category: "Actions" },
  { id: 117, english: "stab", category: "Actions" },
  { id: 118, english: "scratch", category: "Actions" },
  { id: 119, english: "dig", category: "Actions" },
  { id: 120, english: "swim", category: "Actions" },
  { id: 121, english: "fly", category: "Actions" },
  { id: 122, english: "walk", category: "Actions" },
  { id: 123, english: "come", category: "Actions" },
  { id: 124, english: "lie", category: "Actions" },
  { id: 125, english: "sit", category: "Actions" },
  { id: 126, english: "stand", category: "Actions" },
  { id: 127, english: "turn", category: "Actions" },
  { id: 128, english: "fall", category: "Actions" },
  { id: 129, english: "give", category: "Actions" },
  { id: 130, english: "hold", category: "Actions" },
  { id: 131, english: "squeeze", category: "Actions" },
  { id: 132, english: "rub", category: "Actions" },
  { id: 133, english: "wash", category: "Actions" },
  { id: 134, english: "wipe", category: "Actions" },
  { id: 135, english: "pull", category: "Actions" },
  { id: 136, english: "push", category: "Actions" },
  { id: 137, english: "throw", category: "Actions" },
  { id: 138, english: "tie", category: "Actions" },
  { id: 139, english: "sew", category: "Actions" },
  { id: 140, english: "count", category: "Actions" },
  { id: 141, english: "say", category: "Actions" },
  { id: 142, english: "sing", category: "Actions" },
  { id: 143, english: "play", category: "Actions" },
  { id: 144, english: "float", category: "Actions" },
  { id: 145, english: "flow", category: "Actions" },
  { id: 146, english: "freeze", category: "Actions" },
  { id: 147, english: "swell", category: "Actions" },
  { id: 148, english: "burn", category: "Actions" },
  { id: 149, english: "cook", category: "Actions" },
  { id: 150, english: "split", category: "Actions" },

  // Descriptors / Adjectives
  { id: 151, english: "big", category: "Descriptors" },
  { id: 152, english: "small", category: "Descriptors" },
  { id: 153, english: "long", category: "Descriptors" },
  { id: 154, english: "short", category: "Descriptors" },
  { id: 155, english: "wide", category: "Descriptors" },
  { id: 156, english: "narrow", category: "Descriptors" },
  { id: 157, english: "thick", category: "Descriptors" },
  { id: 158, english: "thin", category: "Descriptors" },
  { id: 159, english: "warm", category: "Descriptors" },
  { id: 160, english: "cold", category: "Descriptors" },
  { id: 161, english: "full", category: "Descriptors" },
  { id: 162, english: "new", category: "Descriptors" },
  { id: 163, english: "old", category: "Descriptors" },
  { id: 164, english: "good", category: "Descriptors" },
  { id: 165, english: "bad", category: "Descriptors" },
  { id: 166, english: "round", category: "Descriptors" },
  { id: 167, english: "dry", category: "Descriptors" },
  { id: 168, english: "wet", category: "Descriptors" },
  { id: 169, english: "right", category: "Descriptors" },
  { id: 170, english: "smooth", category: "Descriptors" },
  { id: 171, english: "sharp", category: "Descriptors" },
  { id: 172, english: "dull", category: "Descriptors" },
  { id: 173, english: "dirty", category: "Descriptors" },
  { id: 174, english: "straight", category: "Descriptors" },
  { id: 175, english: "heavy", category: "Descriptors" },
  { id: 176, english: "rotten", category: "Descriptors" },
  { id: 177, english: "correct", category: "Descriptors" },

  // Spatial / Other
  { id: 178, english: "near", category: "Spatial" },
  { id: 179, english: "far", category: "Spatial" },
  { id: 180, english: "right", category: "Spatial" },
  { id: 181, english: "left", category: "Spatial" },
  { id: 182, english: "at", category: "Spatial" },
  { id: 183, english: "in", category: "Spatial" },
  { id: 184, english: "with", category: "Spatial" },
  { id: 185, english: "and", category: "Spatial" },
  { id: 186, english: "if", category: "Spatial" },
  { id: 187, english: "because", category: "Spatial" },
  { id: 188, english: "not", category: "Spatial" },
  { id: 189, english: "here", category: "Spatial" },
  { id: 190, english: "there", category: "Spatial" },
  { id: 191, english: "where", category: "Spatial" },
  { id: 192, english: "when", category: "Spatial" },
  { id: 193, english: "how", category: "Spatial" },

  // Other common
  { id: 194, english: "name", category: "Other" },
  { id: 195, english: "man", category: "Other" },
  { id: 196, english: "woman", category: "Other" },
  { id: 197, english: "person", category: "Other" },
  { id: 198, english: "child", category: "Other" },
  { id: 199, english: "wife", category: "Other" },
  { id: 200, english: "husband", category: "Other" },
  { id: 201, english: "mother", category: "Other" },
  { id: 202, english: "father", category: "Other" },
  { id: 203, english: "night", category: "Other" },
  { id: 204, english: "day", category: "Other" },
  { id: 205, english: "year", category: "Other" },
  { id: 206, english: "rope", category: "Other" },
  { id: 207, english: "road", category: "Other" },
]

/**
 * Match existing glosses against the Swadesh list.
 * Returns matched IDs and the match percentage.
 */
export function matchSwadeshList(glosses: string[]): {
  matched: Set<number>
  percentage: number
  total: number
} {
  const normalizedGlosses = new Set(
    glosses.map(g => g.toLowerCase().trim())
  )

  // Also build a set of individual words from multi-word glosses
  // e.g. "to eat" should match "eat", "big, large" should match "big"
  const expandedGlosses = new Set<string>()
  for (const g of normalizedGlosses) {
    expandedGlosses.add(g)
    // Split by comma, semicolon, slash, "to "
    const parts = g.split(/[,;/]/).map(p => p.trim().replace(/^to\s+/, ""))
    for (const p of parts) {
      expandedGlosses.add(p)
    }
  }

  const matched = new Set<number>()

  for (const concept of SWADESH_LIST) {
    const cEnglish = concept.english.toLowerCase()
    if (expandedGlosses.has(cEnglish)) {
      matched.add(concept.id)
    }
  }

  return {
    matched,
    percentage: Math.round((matched.size / SWADESH_LIST.length) * 100),
    total: SWADESH_LIST.length,
  }
}
