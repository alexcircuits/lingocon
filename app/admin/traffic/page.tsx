import { Suspense } from "react"
import Link from "next/link"
import { Eye, FileText, Globe2, Languages, MonitorSmartphone, Users } from "lucide-react"
import { requireAdmin } from "@/lib/admin"
import { getLiveStats, getTrafficReport, RAW_RETENTION_DAYS, type TrafficReport } from "@/lib/stats/store"
import { utcDayLabel } from "@/lib/utils/utc-days"
import { cn } from "@/lib/utils"
import { StatCard } from "@/components/admin/stat-card"
import { LiveTraffic } from "@/components/admin/live-traffic"
import { CategoryDonutChart, TrendAreaChart } from "@/components/admin/lazy-charts"
import { CHART_COLORS } from "@/components/admin/chart-colors"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"
export const metadata = { title: "Traffic" }

const RANGES = [7, 30, 90, 365] as const
type Range = (typeof RANGES)[number]

function parseRange(raw: string | undefined): Range {
    const days = Number(raw)
    return (RANGES as readonly number[]).includes(days) ? (days as Range) : 30
}

async function LiveSection() {
    return <LiveTraffic initial={await getLiveStats()} />
}

function RankedList({ rows, empty }: { rows: { key: string; label: React.ReactNode; value: number }[]; empty: string }) {
    if (rows.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">{empty}</p>
    return (
        <ul className="space-y-1 text-sm">
            {rows.map((row) => (
                <li key={row.key} className="flex justify-between gap-4 border-b border-border/50 py-1.5 last:border-0">
                    <span className="truncate" title={row.key}>{row.label}</span>
                    <span className="tabular-nums text-muted-foreground">{row.value.toLocaleString("en-US")}</span>
                </li>
            ))}
        </ul>
    )
}

function ListCard({ title, description, icon: Icon, children }: { title: string; description: string; icon: typeof Eye; children: React.ReactNode }) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    )
}

function Totals({ report }: { report: TrafficReport }) {
    const averageVisitors = Math.round(report.totals.visitorDays / report.days)
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Visitors today" value={report.totals.today.visitors.toLocaleString("en-US")} icon={Users} description="Since 00:00 UTC" />
            <StatCard title="Page views today" value={report.totals.today.pageViews.toLocaleString("en-US")} icon={Eye} />
            <StatCard title={`Page views, ${report.days} days`} value={report.totals.pageViews.toLocaleString("en-US")} icon={FileText} />
            <StatCard title="Visitors per day" value={averageVisitors.toLocaleString("en-US")} icon={Users} description={`Average over ${report.days} days`} />
        </div>
    )
}

async function ReportSection({ days }: { days: Range }) {
    const report = await getTrafficReport(days)
    const daily = report.daily.map((d) => ({ ...d, label: utcDayLabel(d.date) }))
    const scope = `last ${days} days`
    const rawScope = days > RAW_RETENTION_DAYS ? `last ${RAW_RETENTION_DAYS} days` : scope

    return (
        <div className="space-y-6">
            <Totals report={report} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ListCard title="Visitors" description={`Distinct visitors per UTC day, ${scope}`} icon={Users}>
                    <TrendAreaChart data={daily} dataKey="visitors" xKey="label" name="Visitors" height={224} emptyMessage="No visitors in this period" />
                </ListCard>
                <ListCard title="Page views" description={`Per UTC day, ${scope}`} icon={Eye}>
                    <TrendAreaChart data={daily} dataKey="pageViews" xKey="label" name="Page views" color={CHART_COLORS[1]} height={224} emptyMessage="No page views in this period" />
                </ListCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                <ListCard title="Top pages" description={rawScope} icon={FileText}>
                    <RankedList
                        empty="No page views yet"
                        rows={report.topPages.map((p) => ({ key: p.path, label: <code className="text-xs">{p.path}</code>, value: p.views }))}
                    />
                </ListCard>
                <ListCard title="Public languages" description={`Most read, ${rawScope}`} icon={Languages}>
                    <RankedList
                        empty="No language pages viewed yet"
                        rows={report.languages.map((l) => ({
                            key: l.slug,
                            label: <Link href={`/lang/${l.slug}`} className="hover:underline">{l.name}</Link>,
                            value: l.views,
                        }))}
                    />
                </ListCard>
                <ListCard title="Referrers" description={`Other sites, ${rawScope}`} icon={Globe2}>
                    <RankedList empty="No visits from other sites yet" rows={report.referrers.map((r) => ({ key: r.host, label: r.host, value: r.views }))} />
                </ListCard>
                <ListCard title="Devices" description={`Page views, ${rawScope}`} icon={MonitorSmartphone}>
                    <CategoryDonutChart data={report.devices.map((d) => ({ name: d.device, value: d.views }))} height={200} emptyMessage="No page views yet" />
                </ListCard>
            </div>
        </div>
    )
}

export default async function AdminTrafficPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
    await requireAdmin()
    const days = parseRange((await searchParams).days)

    return (
        <div className="p-4 md:p-8 space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif mb-2">Traffic</h1>
                    <p className="text-muted-foreground max-w-2xl">
                        Anonymous counts: no cookies, no IP addresses, no accounts, and visitor codes that change every
                        day. Bots, the admin panel and browsers that send Do Not Track are not counted.{" "}
                        <Link href="/cookies" className="underline underline-offset-4">How it works</Link>
                    </p>
                </div>
                <nav aria-label="Period" className="flex rounded-lg border border-border/60 p-1 text-sm">
                    {RANGES.map((range) => (
                        <Link
                            key={range}
                            href={`/admin/traffic?days=${range}`}
                            aria-current={range === days ? "page" : undefined}
                            className={cn(
                                "rounded-md px-3 py-1 transition-colors",
                                range === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {range === 365 ? "1 year" : `${range} days`}
                        </Link>
                    ))}
                </nav>
            </div>

            <Suspense fallback={<div className="h-48 bg-muted rounded-xl animate-pulse" />}>
                <LiveSection />
            </Suspense>

            <Suspense key={days} fallback={<div className="h-96 bg-muted rounded-xl animate-pulse" />}>
                <ReportSection days={days} />
            </Suspense>
        </div>
    )
}
