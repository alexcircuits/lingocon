import { render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import en from "@/messages/en.json"
import type { Backer } from "@/lib/open-collective/parse-backers"

const mocks = vi.hoisted(() => ({ getTopBackers: vi.fn() }))
vi.mock("@/lib/open-collective/top-backers", () => ({ getTopBackers: mocks.getTopBackers }))

import { TopBackers } from "../top-backers"
import { TopBackersSection } from "../top-backers-section"

const COLLECTIVE_URL = "https://opencollective.com/lingocon"

const ada: Backer = {
  name: "Ada Lovelace",
  kind: "individual",
  profileUrl: "https://opencollective.com/ada",
  imageUrl: "https://images.opencollective.com/ada/7a79991/avatar/128.png",
  totalCents: 6400,
}
const acme: Backer = {
  name: "Acme Corp",
  kind: "organization",
  profileUrl: "https://opencollective.com/acme",
  imageUrl: null,
  totalCents: 2450,
}
const anonymous: Backer = { name: null, kind: "individual", profileUrl: null, imageUrl: null, totalCents: 1000 }

function renderIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  )
}

describe("TopBackers", () => {
  it("lists backers in the order given, each linking to their Open Collective profile", () => {
    renderIntl(<TopBackers backers={[ada, acme]} currency="EUR" />)

    // Explicit role: Safari/VoiceOver drops list semantics once `list-style: none` applies.
    expect(screen.getByRole("list")).toHaveAttribute("role", "list")
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(2)

    const first = within(items[0]).getByRole("link", { name: /Ada Lovelace/ })
    expect(first).toHaveAttribute("href", "https://opencollective.com/ada")
    expect(first).toHaveAttribute("target", "_blank")
    expect(first.getAttribute("rel")).toMatch(/noopener/)
    expect(within(items[1]).getByRole("link", { name: /Acme Corp/ })).toHaveAttribute(
      "href",
      "https://opencollective.com/acme",
    )
  })

  it("shows each total in the collective's currency, without needless decimals", () => {
    renderIntl(<TopBackers backers={[ada, acme]} currency="EUR" />)

    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("€64")
    expect(items[0]).not.toHaveTextContent("€64.00")
    expect(items[1]).toHaveTextContent("€24.50")
  })

  it("shows the avatar when there is one and initials when there is not", () => {
    const { container } = renderIntl(<TopBackers backers={[ada, acme]} currency="EUR" />)

    const images = container.querySelectorAll("img")
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute("src", ada.imageUrl)
    expect(images[0]).toHaveAttribute("referrerpolicy", "no-referrer")
    expect(screen.getAllByRole("listitem")[1]).toHaveTextContent("A")
  })

  it("renders an anonymous backer with no link, no avatar and a generic label", () => {
    const { container } = renderIntl(<TopBackers backers={[anonymous]} currency="EUR" />)

    const item = screen.getByRole("listitem")
    expect(item).toHaveTextContent(en.donate.backersAnonymous)
    expect(item).toHaveTextContent("€10")
    expect(within(item).queryByRole("link")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })

  it("links to the full list on Open Collective", () => {
    renderIntl(<TopBackers backers={[ada]} currency="EUR" />)

    expect(screen.getByRole("link", { name: en.donate.backersSeeAll })).toHaveAttribute("href", COLLECTIVE_URL)
  })

  it("invites the first backer when the collective has none yet", () => {
    renderIntl(<TopBackers backers={[]} currency="EUR" />)

    expect(screen.getByRole("heading", { name: en.donate.backersEmptyTitle })).toBeInTheDocument()
    expect(screen.queryByRole("list")).toBeNull()
    expect(screen.getByRole("link", { name: en.donate.backersEmptyCta })).toHaveAttribute("href", COLLECTIVE_URL)
  })
})

describe("TopBackersSection", () => {
  beforeEach(() => {
    mocks.getTopBackers.mockReset()
  })

  it("renders the backers fetched from Open Collective", async () => {
    mocks.getTopBackers.mockResolvedValue({ status: "ok", currency: "EUR", backers: [ada] })

    renderIntl(await TopBackersSection())

    expect(screen.getByRole("heading", { name: en.donate.backersHeading })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Ada Lovelace/ })).toBeInTheDocument()
  })

  it("renders nothing when Open Collective is unavailable", async () => {
    mocks.getTopBackers.mockResolvedValue({ status: "unavailable" })

    expect(await TopBackersSection()).toBeNull()
  })
})
