import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canEditLanguage, canReadLanguage, getUserId } from '@/lib/auth-helpers';
import { findTranslationProblem } from '@/lib/i18n/translation-input';
import { z } from 'zod';

const updateTranslationsSchema = z.object({
  translations: z.record(z.string(), z.string()),
});

export async function GET(
  request: Request,
  { params }: { params: { languageId: string } }
) {
  try {
    // Private languages: owner, collaborators and admins (the old check forgot collaborators).
    if (!(await canReadLanguage(params.languageId, await getUserId()))) {
      return new NextResponse('Not found', { status: 404 });
    }

    const translations = await prisma.conlangTranslation.findMany({
      where: { languageId: params.languageId },
      select: { key: true, value: true },
    });

    const result: Record<string, string> = {};
    for (const t of translations) {
      result[t.key] = t.value;
    }

    return NextResponse.json(result);
  } catch (error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { languageId: string } }
) {
  try {
    // getUserId honours suspension; the old fallback to getDevUserId() threw a 500 in production
    // for every anonymous request.
    const userId = await getUserId();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Scope, not role: a collaborator whose only grant is "submit drafts" is still role EDITOR.
    if (!(await canEditLanguage(params.languageId, userId))) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const body = await request.json();
    const { translations } = updateTranslationsSchema.parse(body);
    const problem = findTranslationProblem(translations);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 422 });
    }

    // Perform upserts in a transaction
    await prisma.$transaction(
      Object.entries(translations).map(([key, value]) =>
        prisma.conlangTranslation.upsert({
          where: {
            languageId_key: {
              languageId: params.languageId,
              key,
            },
          },
          update: { value },
          create: {
            languageId: params.languageId,
            key,
            value,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid request data', { status: 422 });
    }

    console.error('[TRANSLATIONS_PUT]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
