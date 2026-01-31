"use strict";
"use client";

import { useEffect } from "react";

export function PlausibleAnalytics() {
    useEffect(() => {
        const initPlausible = async () => {
            const { init } = await import("@plausible-analytics/tracker");
            const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "lingocon.com";
            const apiHost = process.env.NEXT_PUBLIC_PLAUSIBLE_API_HOST;

            if (!apiHost) {
                console.warn("Plausible Analytics: NEXT_PUBLIC_PLAUSIBLE_API_HOST is missing");
            }

            init({
                domain,
                endpoint: apiHost ? `${apiHost}/api/event` : undefined,
            });
        };

        initPlausible();
    }, []);

    return null;
}
