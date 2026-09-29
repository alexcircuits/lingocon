import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canReadLanguage, getUserId } from '@/lib/auth-helpers';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const language = await prisma.language.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    // Don't hand out ids of private languages the caller can't see.
    if (!language || !(await canReadLanguage(language.id, userId))) {
      return new NextResponse('Not found', { status: 404 });
    }

    return NextResponse.json(language);
  } catch (error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}
