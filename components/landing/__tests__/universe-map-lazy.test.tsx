import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
vi.mock("@/lib/hooks/use-is-mobile", () => ({ useIsMobile: () => false }))
vi.mock("next/dynamic", () => ({ default: () => function Graph() { return <div data-testid="graph" /> } }))
import { UniverseMapLazy } from "../universe-map-lazy"
afterEach(cleanup)
describe("homepage map activation", () => {
  it("mounts the expensive graph only after explicit activation", () => {
    render(<UniverseMapLazy languages={[]} />)
    expect(screen.queryByTestId("graph")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Load interactive map" }))
    expect(screen.getByTestId("graph")).toBeInTheDocument()
  })
})
