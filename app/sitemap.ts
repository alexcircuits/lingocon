import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

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
        {
            url: `${siteUrl}/search`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
        },
    ];

    // Dynamic language pages
    const publicLanguages = await prisma.language.findMany({
        where: { visibility: "PUBLIC" },
        select: {
            slug: true,
            updatedAt: true,
        },
    });

    const languagePages: MetadataRoute.Sitemap = publicLanguages.map((lang) => ({
        url: `${siteUrl}/lang/${lang.slug}`,
        lastModified: lang.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }));

    return [...staticPages, ...languagePages];
}
