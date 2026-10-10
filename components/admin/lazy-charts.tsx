"use client"

import { createContext, useContext, type ComponentProps } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Code-split entry points for the admin charts. The charting library was ~118 kB of the admin
 * overview's first-load JS; it now loads after the page is interactive. `next/dynamic` has to be
 * called from a client module for the split to happen (from the server page it did not).
 *
 * The charts still render on the server (the HTML is unchanged and stays in place while the
 * chunk loads). The placeholder only appears on client-side navigation before the chunk is
 * cached, and takes the chart's own height so nothing shifts when it arrives.
 */
type Charts = typeof import("./charts")

/** Same default as the chart components. */
const DEFAULT_CHART_HEIGHT = 256
const ChartHeight = createContext(DEFAULT_CHART_HEIGHT)

function ChartPlaceholder() {
    const height = useContext(ChartHeight)
    return <Skeleton className="w-full rounded-lg" style={{ height }} />
}

const TrendAreaChartImpl = dynamic(() => import("./charts").then((m) => m.TrendAreaChart), { loading: ChartPlaceholder })
const GroupedBarChartImpl = dynamic(() => import("./charts").then((m) => m.GroupedBarChart), { loading: ChartPlaceholder })
const CategoryDonutChartImpl = dynamic(() => import("./charts").then((m) => m.CategoryDonutChart), { loading: ChartPlaceholder })
const RankedBarChartImpl = dynamic(() => import("./charts").then((m) => m.RankedBarChart), { loading: ChartPlaceholder })

export function TrendAreaChart(props: ComponentProps<Charts["TrendAreaChart"]>) {
    return (
        <ChartHeight.Provider value={props.height ?? DEFAULT_CHART_HEIGHT}>
            <TrendAreaChartImpl {...props} />
        </ChartHeight.Provider>
    )
}

export function GroupedBarChart(props: ComponentProps<Charts["GroupedBarChart"]>) {
    return (
        <ChartHeight.Provider value={props.height ?? DEFAULT_CHART_HEIGHT}>
            <GroupedBarChartImpl {...props} />
        </ChartHeight.Provider>
    )
}

export function CategoryDonutChart(props: ComponentProps<Charts["CategoryDonutChart"]>) {
    return (
        <ChartHeight.Provider value={props.height ?? DEFAULT_CHART_HEIGHT}>
            <CategoryDonutChartImpl {...props} />
        </ChartHeight.Provider>
    )
}

export function RankedBarChart(props: ComponentProps<Charts["RankedBarChart"]>) {
    return (
        <ChartHeight.Provider value={props.height ?? DEFAULT_CHART_HEIGHT}>
            <RankedBarChartImpl {...props} />
        </ChartHeight.Provider>
    )
}
