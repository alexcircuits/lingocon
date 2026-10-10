/**
 * Times the studio overview's lexicon analysis in TypeScript (the fallback path):
 * the Prisma load and the validation + Swadesh computation, separately. With
 * LINGOCON_API_URL and LINGOCON_API_TOKEN set it also times the Rust service's
 * endpoint end to end (HTTP + DB load + analysis) and checks that both return
 * the same warnings, total and Swadesh matches.
 *
 *   DATABASE_URL=postgresql://…/lingocon_rewrite_test_… npx tsx scripts/bench-overview-analysis.ts <languageId> [samples]
 *
 * Read-only. Prints JSON with per-phase medians so it can be compared with the
 * Rust service on the same data and machine.
 */
import { isDeepStrictEqual } from "node:util"
import { prisma } from "@/lib/prisma"
import { getValidationWarnings } from "@/lib/utils/validation"
import { matchSwadeshList } from "@/lib/data/swadesh-list"

const MAX_WARNINGS_SHOWN = 50

const [languageId, samplesArg] = process.argv.slice(2)
if (!languageId) {
  console.error("usage: bench-overview-analysis.ts <languageId> [samples]")
  process.exit(1)
}
const samples = Number(samplesArg ?? 5)

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

async function once() {
  const t0 = performance.now()
  const [language, symbols, entries, paradigms] = await Promise.all([
    prisma.language.findUniqueOrThrow({ where: { id: languageId }, select: { allowsDiacritics: true } }),
    prisma.scriptSymbol.findMany({ where: { languageId }, select: { symbol: true, capitalSymbol: true } }),
    prisma.dictionaryEntry.findMany({ where: { languageId }, select: { lemma: true, gloss: true, paradigmId: true }, orderBy: { id: "asc" } }),
    prisma.paradigm.findMany({ where: { languageId }, select: { id: true } }),
  ])
  const t1 = performance.now()
  const warnings = getValidationWarnings(symbols, entries, paradigms, { allowsDiacritics: language.allowsDiacritics })
  const t2 = performance.now()
  const swadesh = matchSwadeshList(entries.map((entry) => entry.gloss))
  const t3 = performance.now()
  const analysis = {
    warnings: warnings.slice(0, MAX_WARNINGS_SHOWN),
    total: warnings.length,
    matchedIds: Array.from(swadesh.matched).sort((a, b) => a - b),
  }
  return { loadMs: t1 - t0, validateMs: t2 - t1, swadeshMs: t3 - t2, totalMs: t3 - t0, entries: entries.length, analysis }
}

async function serviceOnce(baseUrl: string, token: string) {
  const started = performance.now()
  const response = await fetch(`${baseUrl}/v1/internal/lexicon-analysis`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ languageId }),
  })
  if (!response.ok) throw new Error(`service answered HTTP ${response.status}`)
  const body = await response.text()
  return { totalMs: performance.now() - started, bytes: body.length, analysis: JSON.parse(body) as unknown }
}

async function main() {
  await once() // warm-up
  const runs: Awaited<ReturnType<typeof once>>[] = []
  for (let i = 0; i < samples; i++) runs.push(await once())
  const pick = (key: "loadMs" | "validateMs" | "swadeshMs" | "totalMs") => Number(median(runs.map((run) => run[key])).toFixed(1))
  const reference = runs[0].analysis
  const result: Record<string, unknown> = {
    languageId, samples, entries: runs[0].entries, warnings: reference.total, matched: reference.matchedIds.length,
    medianMs: { load: pick("loadMs"), validate: pick("validateMs"), swadesh: pick("swadeshMs"), total: pick("totalMs") },
  }

  const baseUrl = process.env.LINGOCON_API_URL?.replace(/\/+$/, "")
  const token = process.env.LINGOCON_API_TOKEN
  if (baseUrl && token) {
    await serviceOnce(baseUrl, token) // warm-up
    const serviceRuns: Awaited<ReturnType<typeof serviceOnce>>[] = []
    for (let i = 0; i < samples; i++) serviceRuns.push(await serviceOnce(baseUrl, token))
    result.service = {
      medianMs: Number(median(serviceRuns.map((run) => run.totalMs)).toFixed(1)),
      responseBytes: serviceRuns[0].bytes,
      identicalToTypeScript: serviceRuns.every((run) => isDeepStrictEqual(run.analysis, reference)),
    }
  }
  console.log(JSON.stringify(result))
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
