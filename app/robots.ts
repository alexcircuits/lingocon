import { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
    const siteUrl = getSiteUrl();

    const disallow = ["/api/", "/studio/", "/dashboard/", "/settings/", "/favorites/", "/admin/"];
    const publicAreas = ["/", "/lang/", "/browse", "/search", "/families", "/modules", "/docs", "/users/", "/uploads/"];

    return {
        rules: [
            // Allow Googlebot full access to public pages
            {
                userAgent: "Googlebot",
                allow: publicAreas,
                disallow,
            },
            // Allow Google Image crawler to index language flags and uploads
            {
                userAgent: "Googlebot-Image",
                allow: ["/uploads/"],
                disallow: [],
            },
            // General rules for all other bots
            {
                userAgent: "*",
                allow: publicAreas,
                disallow,
            },
        ],
        sitemap: `${siteUrl}/sitemap.xml`,
        host: siteUrl,
    };
}
