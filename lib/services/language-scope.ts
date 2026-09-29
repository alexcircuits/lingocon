/**
 * Guards for records that must belong to the language a caller is authorized for. Actions receive
 * ids from the client; checking permission on a client-supplied languageId is only meaningful if
 * the referenced rows actually live in that language.
 */
import { prisma } from "@/lib/prisma"
import { NotFoundError } from "@/lib/errors"

/** Paradigms are per-language; linking another language's paradigm would embed its table here. */
export async function assertParadigmInLanguage(
  paradigmId: string | null | undefined,
  languageId: string
): Promise<void> {
  if (!paradigmId) return
  const paradigm = await prisma.paradigm.findUnique({
    where: { id: paradigmId },
    select: { languageId: true },
  })
  if (paradigm?.languageId !== languageId) throw new NotFoundError("Paradigm", paradigmId)
}
