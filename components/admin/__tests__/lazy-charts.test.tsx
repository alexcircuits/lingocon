import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// The charting library itself is not under test: only the loading boundary around it.
vi.mock("../charts", () => ({
  TrendAreaChart: ({ emptyMessage }: { emptyMessage?: string }) => <p>{emptyMessage}</p>,
  GroupedBarChart: () => <p>grouped</p>,
  CategoryDonutChart: () => <p>donut</p>,
  RankedBarChart: () => <p>ranked</p>,
}))
import { RankedBarChart, TrendAreaChart } from "../lazy-charts"

describe("code-split admin charts", () => {
  it("reserves the chart's height until the chart code has loaded", async () => {
    const { container } = render(<TrendAreaChart data={[]} dataKey="signups" height={208} emptyMessage="No signups" />)
    const placeholder = container.firstElementChild as HTMLElement
    expect(placeholder).toHaveClass("animate-pulse")
    expect(placeholder.style.height).toBe("208px")

    expect(await screen.findByText("No signups")).toBeInTheDocument()
    expect(container.querySelector(".animate-pulse")).toBeNull()
  })

  it("uses the charts' default height when none is given", async () => {
    // A chart not rendered yet in this file (a loaded chart renders at once, without placeholder).
    const { container } = render(<RankedBarChart data={[]} dataKey="favorites" />)
    expect((container.firstElementChild as HTMLElement).style.height).toBe("256px")
    expect(await screen.findByText("ranked")).toBeInTheDocument()
  })
})
