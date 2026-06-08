import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTotalKeyCount } from '@/lib/i18n/config';
import { getUserId } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const userId = await getUserId();

    // Languages that show up in the site-wide switcher: public + has at least
    // one translated string. Additionally, the signed-in user's *own* languages
    // (or ones they collaborate on) are surfaced regardless of visibility so
    // they can preview their own translations before publishing.
    const translatedLanguages = await prisma.language.findMany({
      where: {
        uiTranslations: { some: {} },
        OR: [
          { visibility: "PUBLIC" },
          ...(userId
            ? [
                { ownerId: userId },
                { collaborators: { some: { userId } } },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        flagUrl: true,
        visibility: true,
        ownerId: true,
        owner: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            uiTranslations: true,
          },
        },
      },
    });

    // We need base English to calculate percentage
    const baseMessages = (await import('@/messages/en.json')).default;
    const totalKeys = getTotalKeyCount(baseMessages);

    const availableTranslations = translatedLanguages.map((lang) => {
      const translatedCount = lang._count.uiTranslations;
      const percentage = totalKeys > 0 ? Math.round((translatedCount / totalKeys) * 100) : 0;

      return {
        id: lang.id,
        name: lang.name,
        flagUrl: lang.flagUrl,
        ownerName: lang.owner.name,
        translatedCount,
        totalKeys,
        percentage,
        // Owner-only preview when the language isn't public yet — lets the
        // creator switch the UI to test their own work before publishing.
        isOwnerPreview: lang.visibility !== "PUBLIC" && userId !== null && lang.ownerId === userId,
      };
    }).sort((a, b) => b.percentage - a.percentage);

    return NextResponse.json(availableTranslations);
  } catch (error) {
    console.error('[AVAILABLE_TRANSLATIONS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
