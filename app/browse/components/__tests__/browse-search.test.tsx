import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Like Next: useSearchParams() keeps its identity until the URL changes.
const nav = vi.hoisted(() => {
  const state = { query: "", params: new URLSearchParams(), push: (_url: string) => {} }
  return {
    state,
    setQuery(query: string) {
      state.query = query
      state.params = new URLSearchParams(query)
    },
  }
})
const push = vi.fn((url: string) => nav.state.push(url))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => nav.state.params,
}))
import { BrowseSearch } from "../browse-search"

beforeEach(() => {
  vi.useFakeTimers()
  push.mockClear()
  nav.setQuery("")
  nav.state.push = () => {}
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const field = () => screen.getByPlaceholderText("Filter languages...")
const settle = () => act(() => vi.advanceTimersByTime(400))

describe("browse search", () => {
  it("does not navigate on load: the URL already holds the query", () => {
    nav.setQuery("q=elvish&sort=popular")
    render(<BrowseSearch />)
    settle()
    expect(push).not.toHaveBeenCalled()
  })

  it("puts a typed query in the URL once typing pauses, back on page one", () => {
    nav.setQuery("sort=popular&page=3")
    render(<BrowseSearch />)
    fireEvent.change(field(), { target: { value: "dwarv" } })
    settle()
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith("/browse?sort=popular&q=dwarv")
  })

  it("follows a query changed by back/forward without pushing the old one again", () => {
    nav.setQuery("q=elvish")
    const { rerender } = render(<BrowseSearch />)
    nav.setQuery("q=orcish")
    rerender(<BrowseSearch />)
    settle()
    expect(field()).toHaveValue("orcish")
    expect(push).not.toHaveBeenCalled()
  })

  it("keeps typing that continued while its own navigation was in flight", () => {
    // The push commits only after the server answers; meanwhile the person types on.
    const pending: string[] = []
    nav.state.push = (url) => { pending.push(url) }
    const { rerender } = render(<BrowseSearch />)
    fireEvent.change(field(), { target: { value: "dw" } })
    settle()
    fireEvent.change(field(), { target: { value: "dwarf" } })
    nav.setQuery(pending.shift()!.split("?")[1])
    rerender(<BrowseSearch />)
    expect(field()).toHaveValue("dwarf")
    settle()
    expect(push).toHaveBeenLastCalledWith("/browse?q=dwarf")
  })

  it("follows back and then forward to a query it pushed itself", () => {
    nav.state.push = (url) => nav.setQuery(url.split("?")[1])
    const { rerender } = render(<BrowseSearch />)
    fireEvent.change(field(), { target: { value: "dwarf" } })
    settle()
    rerender(<BrowseSearch />) // the push landed: ?q=dwarf
    nav.setQuery("") // back
    rerender(<BrowseSearch />)
    settle()
    expect(field()).toHaveValue("")
    nav.setQuery("q=dwarf") // forward
    rerender(<BrowseSearch />)
    settle()
    expect(field()).toHaveValue("dwarf")
    expect(push).toHaveBeenCalledTimes(1)
  })
})
