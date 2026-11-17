import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { LOGO_C_PATH, LOGO_L_PATH } from "../../lib/brand/logo"
import { LogoMark } from "../brand/logo-mark"

describe("LogoMark", () => {
  it("draws the L and the C as two shapes so each takes its own colour", () => {
    const { container } = render(<LogoMark />)
    const paths = Array.from(container.querySelectorAll("path")).map((path) => path.getAttribute("d"))
    expect(paths).toEqual([LOGO_L_PATH, LOGO_C_PATH])
  })

  it("stays silent for assistive tech when it sits beside the wordmark", () => {
    const { container } = render(<LogoMark />)
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("is announced by name when it stands alone", () => {
    render(<LogoMark title="LingoCon" />)
    expect(screen.getByRole("img", { name: "LingoCon" })).toBeInTheDocument()
  })

  it("lets the caller size and recolour it", () => {
    const { container } = render(<LogoMark className="h-12 w-12 text-white" />)
    const svg = container.querySelector("svg")
    expect(svg).toHaveClass("h-12", "w-12", "text-white")
    expect(svg).not.toHaveClass("text-primary")
  })
})
