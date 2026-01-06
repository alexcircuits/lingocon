import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lingocon.com";

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/api/",
                    "/studio/",
                    "/dashboard/",
                    "/settings/",
                    "/favorites/",
                ],
            },
        ],
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
