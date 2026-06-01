import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { DOC_PAGES } from "@/lib/docs/site-docs";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteUrl = getSiteUrl();
    const now = new Date();

    // ---- Static marketing / informational pages -------------------------------
    const staticPages: MetadataRoute.Sitemap = [
        { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
        { url: `${siteUrl}/browse`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
        { url: `${siteUrl}/families`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
        { url: `${siteUrl}/modules`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
        { url: `${siteUrl}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
        { url: `${siteUrl}/contributions`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
        { url: `${siteUrl}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.65 },
        ...DOC_PAGES.map((p) => ({
            url: `${siteUrl}/docs/${p.slug}`,
            lastModified: now,
            changeFrequency: "weekly" as const,
            priority: 0.55,
        })),
        { url: `${siteUrl}/donate`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
        { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
        { url: `${siteUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
        { url: `${siteUrl}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    ];

    // ---- Public languages + their content sub-pages ---------------------------
    // Only PUBLIC languages with real content are included to avoid thin-content
    // penalties. Each language expands into the section pages that actually have
    // content, plus deep links to individual grammar pages, articles and texts.
    const publicLanguages = await prisma.language.findMany({
        where: {
            visibility: "PUBLIC",
            slug: { not: "-" },
        },
        select: {
            slug: true,
            updatedAt: true,
            _count: {
                select: {
                    dictionaryEntries: true,
                    grammarPages: true,
                    scriptSymbols: true,
                    paradigms: true,
                    articles: true,
                    texts: true,
                },
            },
            grammarPages: {
                select: { slug: true, updatedAt: true },
                orderBy: { order: "asc" },
            },
            articles: {
                where: { published: true },
                select: { slug: true, updatedAt: true },
            },
            texts: {
                where: { published: true },
                select: { slug: true, updatedAt: true },
            },
        },
    });

    const languagePages: MetadataRoute.Sitemap = [];

    for (const lang of publicLanguages) {
        const c = lang._count;
        const hasContent =
            c.dictionaryEntries > 0 ||
            c.grammarPages > 0 ||
            c.articles > 0 ||
            c.texts > 0 ||
            c.scriptSymbols > 0;
        const isValidSlug = lang.slug.length > 1 && lang.slug !== "-";

        if (!hasContent || !isValidSlug) continue;

        const base = `${siteUrl}/lang/${lang.slug}`;

        // Language hub
        languagePages.push({
            url: base,
            lastModified: lang.updatedAt,
            changeFrequency: "weekly",
            priority: 0.8,
        });

        // Section index pages (only when there is content behind them)
        if (c.scriptSymbols > 0) {
            languagePages.push({ url: `${base}/alphabet`, lastModified: lang.updatedAt, changeFrequency: "monthly", priority: 0.6 });
            languagePages.push({ url: `${base}/phonology`, lastModified: lang.updatedAt, changeFrequency: "monthly", priority: 0.6 });
        }
        if (c.grammarPages > 0) {
            languagePages.push({ url: `${base}/grammar`, lastModified: lang.updatedAt, changeFrequency: "weekly", priority: 0.7 });
        }
        if (c.dictionaryEntries > 0) {
            languagePages.push({ url: `${base}/dictionary`, lastModified: lang.updatedAt, changeFrequency: "weekly", priority: 0.7 });
        }
        if (c.paradigms > 0) {
            languagePages.push({ url: `${base}/paradigms`, lastModified: lang.updatedAt, changeFrequency: "monthly", priority: 0.55 });
        }
        if (c.articles > 0) {
            languagePages.push({ url: `${base}/articles`, lastModified: lang.updatedAt, changeFrequency: "weekly", priority: 0.6 });
        }
        if (c.texts > 0) {
            languagePages.push({ url: `${base}/texts`, lastModified: lang.updatedAt, changeFrequency: "weekly", priority: 0.6 });
        }

        // Deep content links
        for (const page of lang.grammarPages) {
            languagePages.push({ url: `${base}/grammar/${page.slug}`, lastModified: page.updatedAt, changeFrequency: "monthly", priority: 0.6 });
        }
        for (const article of lang.articles) {
            languagePages.push({ url: `${base}/articles/${article.slug}`, lastModified: article.updatedAt, changeFrequency: "monthly", priority: 0.55 });
        }
        for (const text of lang.texts) {
            languagePages.push({ url: `${base}/texts/${text.slug}`, lastModified: text.updatedAt, changeFrequency: "monthly", priority: 0.55 });
        }
    }

    // ---- Published modules ----------------------------------------------------
    const publishedModules = await prisma.module.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
    });

    const modulePages: MetadataRoute.Sitemap = publishedModules.map((m) => ({
        url: `${siteUrl}/modules/${m.slug}`,
        lastModified: m.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.5,
    }));

    return [...staticPages, ...languagePages, ...modulePages];
}
