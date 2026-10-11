import { act } from "@testing-library/react"
import { useRef, useState } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import { useAdoptTypedValue } from "../use-adopt-typed-value"

const slugOf = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-")

/** A server-rendered name field whose slug follows it, like the new-language form. */
function NameAndSlug() {
  const [name, setName] = useState("")
  const ref = useRef<HTMLInputElement>(null)
  useAdoptTypedValue(ref, name, setName)
  return (
    <>
      <input id="name" ref={ref} value={name} onChange={(e) => setName(e.target.value)} />
      <output id="slug">{slugOf(name)}</output>
    </>
  )
}

let root: Root | null = null
afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.innerHTML = ""
})

async function hydrateAfterTyping(typed: string | null) {
  const container = document.createElement("div")
  container.innerHTML = renderToString(<NameAndSlug />)
  document.body.appendChild(container)
  // What a person types while the page's JavaScript is still loading.
  if (typed !== null) container.querySelector<HTMLInputElement>("#name")!.value = typed
  await act(async () => {
    root = hydrateRoot(container, <NameAndSlug />)
  })
  return {
    name: container.querySelector<HTMLInputElement>("#name")!.value,
    slug: container.querySelector("#slug")!.textContent,
  }
}

describe("useAdoptTypedValue", () => {
  it("keeps text typed before hydration and puts it in state", async () => {
    await expect(hydrateAfterTyping("Wizard Tongue")).resolves.toEqual({ name: "Wizard Tongue", slug: "wizard-tongue" })
  })

  it("leaves an untouched field alone", async () => {
    await expect(hydrateAfterTyping(null)).resolves.toEqual({ name: "", slug: "" })
  })
})
