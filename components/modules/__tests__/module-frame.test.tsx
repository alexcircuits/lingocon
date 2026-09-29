import { describe, it, expect } from "vitest"
import { renderToString } from "react-dom/server"
import { render } from "@testing-library/react"
import { ModuleFrame } from "../module-frame"

const props = {
  slug: "lexicon-stats",
  moduleId: "m1",
  languageId: "lang-1",
  languageSlug: "demo",
  permissions: ["read:dictionary"],
}

describe("ModuleFrame", () => {
  it("does not server-render the sandbox document, so its ready message can't beat hydration", () => {
    const html = renderToString(<ModuleFrame {...props} />)
    expect(html).toContain("<iframe")
    expect(html.toLowerCase()).not.toContain("srcdoc")
  })

  it("loads the sandbox document once mounted on the client", () => {
    const { container } = render(<ModuleFrame {...props} />)
    const iframe = container.querySelector("iframe")!
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts")
    expect(iframe.getAttribute("srcdoc")).toContain("Content-Security-Policy")
  })
})
