import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { DOC_PAGES } from "@/lib/docs/site-docs";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lingocon.com";

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: siteUrl,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 1,
        },
        {
            url: `${siteUrl}/browse`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${siteUrl}/families`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${siteUrl}/search`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
        },
        {
            url: `${siteUrl}/contributions`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.6,
        },
        {
            url: `${siteUrl}/docs`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.65,
        },
        ...DOC_PAGES.map((p) => ({
            url: `${siteUrl}/docs/${p.slug}`,
            lastModified: new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.55,
        })),
        {
            url: `${siteUrl}/donate`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${siteUrl}/contact`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.4,
        },
        {
            url: `${siteUrl}/login`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.3,
        },
        {
            url: `${siteUrl}/register`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.3,
        },
    ];

    // Dynamic language pages
    // Only include PUBLIC languages that have actual content to avoid "thin content" penalties
    const publicLanguages = await prisma.language.findMany({
        where: {
            visibility: "PUBLIC",
            slug: {
                not: "-", // Exclude placeholder slugs
            }
        },
        select: {
            slug: true,
            updatedAt: true,
            _count: {
                select: {
                    dictionaryEntries: true,
                    grammarPages: true,
                    articles: true,
                    texts: true,
                }
            }
        },
    });

    const languagePages: MetadataRoute.Sitemap = publicLanguages
        .filter(lang => {
            // Filter out languages with no content (empty shells)
            const hasContent =
                lang._count.dictionaryEntries > 0 ||
                lang._count.grammarPages > 0 ||
                lang._count.articles > 0 ||
                lang._count.texts > 0;

            // Filter out invalid slugs (too short or just hyphens)
            const isValidSlug = lang.slug.length > 1 && lang.slug !== '-';

            return hasContent && isValidSlug;
        })
        .map((lang) => ({
            url: `${siteUrl}/lang/${lang.slug}`,
            lastModified: lang.updatedAt,
            changeFrequency: "weekly" as const,
            priority: 0.8,
        }));

    return [...staticPages, ...languagePages];
}
