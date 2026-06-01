"use client"

import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

/**
 * Theme-aware data-visualisation palette. These read the CSS variables defined
 * in globals.css, so charts automatically follow the active palette (Aurora /
 * Classic) and light / dark mode without any extra wiring.
 */
export const CHART_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6))",
]

const AXIS_PROPS = {
    stroke: "hsl(var(--muted-foreground))",
    tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
    tickLine: false,
    axisLine: false,
} as const

interface TooltipEntry {
    name?: string
    value?: number | string
    color?: string
    dataKey?: string | number
}

function ChartTooltip({
    active,
    payload,
    label,
    valueFormatter,
}: {
    active?: boolean
    payload?: TooltipEntry[]
    label?: string
    valueFormatter?: (value: number) => string
}) {
    if (!active || !payload || payload.length === 0) return null

    return (
        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
            {label && (
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
            )}
            <div className="space-y-1">
                {payload.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                        <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="capitalize text-muted-foreground">{entry.name}</span>
                        <span className="ml-auto font-medium tabular-nums">
                            {valueFormatter && typeof entry.value === "number"
                                ? valueFormatter(entry.value)
                                : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            {message}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Single-series gradient area chart (e.g. user signups over time)     */
/* ------------------------------------------------------------------ */

export function TrendAreaChart({
    data,
    dataKey,
    xKey = "date",
    name,
    color = CHART_COLORS[0],
    height = 256,
    emptyMessage = "No data for this period",
}: {
    data: Array<Record<string, string | number>>
    dataKey: string
    xKey?: string
    name?: string
    color?: string
    height?: number
    emptyMessage?: string
}) {
    const hasData = data.some((d) => Number(d[dataKey]) > 0)
    const gradientId = `area-${dataKey}`

    if (!hasData) {
        return <div style={{ height }}><EmptyState message={emptyMessage} /></div>
    }

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                    />
                    <XAxis dataKey={xKey} {...AXIS_PROPS} minTickGap={24} />
                    <YAxis {...AXIS_PROPS} allowDecimals={false} width={36} />
                    <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                    />
                    <Area
                        type="monotone"
                        dataKey={dataKey}
                        name={name ?? dataKey}
                        stroke={color}
                        strokeWidth={2}
                        fill={`url(#${gradientId})`}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Grouped bar chart (e.g. languages vs entries over time)             */
/* ------------------------------------------------------------------ */

export function GroupedBarChart({
    data,
    series,
    xKey = "date",
    height = 256,
    emptyMessage = "No data for this period",
}: {
    data: Array<Record<string, string | number>>
    series: Array<{ key: string; name: string; color: string }>
    xKey?: string
    height?: number
    emptyMessage?: string
}) {
    const hasData = data.some((d) => series.some((s) => Number(d[s.key]) > 0))

    if (!hasData) {
        return <div style={{ height }}><EmptyState message={emptyMessage} /></div>
    }

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                    />
                    <XAxis dataKey={xKey} {...AXIS_PROPS} minTickGap={24} />
                    <YAxis {...AXIS_PROPS} allowDecimals={false} width={36} />
                    <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    />
                    {series.map((s) => (
                        <Bar
                            key={s.key}
                            dataKey={s.key}
                            name={s.name}
                            fill={s.color}
                            radius={[3, 3, 0, 0]}
                            maxBarSize={28}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Donut chart with side legend (e.g. activity by content type)        */
/* ------------------------------------------------------------------ */

export function CategoryDonutChart({
    data,
    height = 256,
    emptyMessage = "No activity recorded",
}: {
    data: Array<{ name: string; value: number }>
    height?: number
    emptyMessage?: string
}) {
    const total = data.reduce((sum, d) => sum + d.value, 0)

    if (total === 0) {
        return <div style={{ height }}><EmptyState message={emptyMessage} /></div>
    }

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                    >
                        {data.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        content={
                            <ChartTooltip
                                valueFormatter={(v) =>
                                    `${v} (${Math.round((v / total) * 100)}%)`
                                }
                            />
                        }
                    />
                    <Legend
                        verticalAlign="middle"
                        align="right"
                        layout="vertical"
                        iconType="circle"
                        iconSize={9}
                        formatter={(value) => (
                            <span className="text-xs capitalize text-muted-foreground">{value}</span>
                        )}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Horizontal ranked bar chart (e.g. top languages by favourites)      */
/* ------------------------------------------------------------------ */

export function RankedBarChart({
    data,
    dataKey,
    labelKey = "name",
    color = CHART_COLORS[0],
    height = 256,
    emptyMessage = "No data yet",
}: {
    data: Array<Record<string, string | number>>
    dataKey: string
    labelKey?: string
    color?: string
    height?: number
    emptyMessage?: string
}) {
    const hasData = data.some((d) => Number(d[dataKey]) > 0)

    if (!hasData) {
        return <div style={{ height }}><EmptyState message={emptyMessage} /></div>
    }

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="hsl(var(--border))"
                    />
                    <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
                    <YAxis
                        type="category"
                        dataKey={labelKey}
                        {...AXIS_PROPS}
                        width={110}
                        tickFormatter={(v: string) =>
                            v.length > 16 ? `${v.slice(0, 15)}…` : v
                        }
                    />
                    <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    />
                    <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
