import type { Language, DictionaryEntry, ScriptSymbol, LanguageMeta } from "./types"

// Injected at build time via vite define, or falls back to production URL
const BASE_URL = (typeof __LINGOCON_API__ !== "undefined" ? __LINGOCON_API__ : "https://lingocon.io") as string

declare const __LINGOCON_API__: string

async function apiFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
  extraHeaders: Record<string, string> = {}
): Promise<{ data: T | null; status: number; etag: string | null }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...extraHeaders,
      ...(options.headers as Record<string, string> | undefined),
    },
  })
  const etag = res.headers.get("ETag")
  if (res.status === 304) return { data: null, status: 304, etag }
  if (!res.ok) return { data: null, status: res.status, etag }
  const data = (await res.json()) as T
  return { data, status: res.status, etag }
}

export async function fetchLanguages(token: string): Promise<Language[]> {
  const { data } = await apiFetch<{ languages: Language[] }>("/api/ext/languages", token)
  return data?.languages ?? []
}

export interface DictionaryPage {
  entries: DictionaryEntry[]
  total: number
  page: number
  limit: number
  updatedAt: string
  etag: string | null
}

export async function fetchDictionaryPage(
  token: string,
  languageId: string,
  page: number,
  ifNoneMatch?: string
): Promise<DictionaryPage | null> {
  const headers: Record<string, string> = ifNoneMatch ? { "If-None-Match": ifNoneMatch } : {}
  const { data, status, etag } = await apiFetch<Omit<DictionaryPage, "etag">>(
    `/api/ext/dictionary?languageId=${languageId}&page=${page}`,
    token,
    {},
    headers
  )
  if (status === 304) return null
  if (!data) return null
  return { ...data, etag }
}

export async function fetchDictionarySince(
  token: string,
  languageId: string,
  since: string
): Promise<DictionaryEntry[]> {
  const all: DictionaryEntry[] = []
  let page = 1
  while (true) {
    const { data } = await apiFetch<{ entries: DictionaryEntry[]; total: number; limit: number }>(
      `/api/ext/dictionary?languageId=${languageId}&since=${encodeURIComponent(since)}&page=${page}`,
      token
    )
    if (!data || data.entries.length === 0) break
    all.push(...data.entries)
    if (all.length >= data.total) break
    page++
  }
  return all
}

export async function fetchScript(
  token: string,
  languageId: string,
  ifNoneMatch?: string
): Promise<{ symbols: ScriptSymbol[]; etag: string | null } | null> {
  const headers: Record<string, string> = ifNoneMatch ? { "If-None-Match": ifNoneMatch } : {}
  const { data, status, etag } = await apiFetch<{ symbols: ScriptSymbol[] }>(
    `/api/ext/script?languageId=${languageId}`,
    token,
    {},
    headers
  )
  if (status === 304) return null
  if (!data) return null
  return { symbols: data.symbols, etag }
}

export async function fetchLanguageMeta(token: string, languageId: string): Promise<LanguageMeta | null> {
  const { data } = await apiFetch<LanguageMeta>(
    `/api/ext/language-meta?languageId=${languageId}`,
    token
  )
  return data
}
