import { revalidatePath } from "next/cache"

/** Revalidate dictionary pages for a language (studio + public) */
export function revalidateDictionary(slug: string) {
  revalidatePath(`/studio/lang/${slug}/dictionary`)
  revalidatePath(`/lang/${slug}/dictionary`)
}

/** Revalidate grammar pages for a language (studio + public) */
export function revalidateGrammar(slug: string) {
  revalidatePath(`/studio/lang/${slug}/grammar`)
  revalidatePath(`/lang/${slug}/grammar`)
}

/** Revalidate alphabet/script pages for a language (studio + public) */
export function revalidateAlphabet(slug: string) {
  revalidatePath(`/studio/lang/${slug}/alphabet`)
  revalidatePath(`/lang/${slug}/alphabet`)
}

/** Revalidate phonology pages for a language (studio + public) */
export function revalidatePhonology(slug: string) {
  revalidatePath(`/studio/lang/${slug}/phonology`)
  revalidatePath(`/lang/${slug}/phonology`)
}

/** Revalidate paradigm pages for a language (studio + public) */
export function revalidateParadigms(slug: string) {
  revalidatePath(`/studio/lang/${slug}/paradigms`)
  revalidatePath(`/lang/${slug}/paradigms`)
}

/** Revalidate the language overview and settings */
export function revalidateLanguage(slug: string) {
  revalidatePath(`/studio/lang/${slug}`)
  revalidatePath(`/studio/lang/${slug}/settings`)
  revalidatePath(`/lang/${slug}`)
}

/** Revalidate studio dashboard */
export function revalidateStudio() {
  revalidatePath("/studio")
  revalidatePath("/dashboard")
}

/** Revalidate language family pages */
export function revalidateFamilies() {
  revalidatePath("/studio")
  revalidatePath("/dashboard/families")
}

/** Revalidate articles for a language */
export function revalidateArticles(slug: string) {
  revalidatePath(`/studio/lang/${slug}/articles`)
  revalidatePath(`/lang/${slug}/articles`)
}

/** Revalidate texts for a language */
export function revalidateTexts(slug: string) {
  revalidatePath(`/studio/lang/${slug}/texts`)
  revalidatePath(`/lang/${slug}/texts`)
}

/** Revalidate browse/discovery pages */
export function revalidateBrowse() {
  revalidatePath("/browse")
}
