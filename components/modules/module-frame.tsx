"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import {
  buildSandboxDoc,
  buildSandboxDocFromCode,
} from "@/lib/modules/runtime-bundles"
import {
  isRuntimeMethod,
  permissionForMethod,
  isWidgetMessage,
  type HostInitMessage,
  type HostResponseMessage,
} from "@/lib/modules/runtime-protocol"

type ModuleFrameProps = {
  slug: string
  moduleId?: string
  languageId: string
  languageSlug: string
  permissions: string[]
  /** Author-supplied widget source. Falls back to a first-party bundle by slug. */
  bundleCode?: string | null
  /** Data endpoint the host relays requests to (defaults to the production route). */
  dataUrl?: string
}

/**
 * Renders a module inside a locked-down `sandbox="allow-scripts"` iframe
 * (null origin: no cookies, DOM, storage, or same-origin network). All data
 * access is brokered here against the granted `permissions` and the
 * capability-gated `/api/modules/data` route.
 */
export function ModuleFrame({
  slug,
  moduleId,
  languageId,
  languageSlug,
  permissions,
  bundleCode,
  dataUrl = "/api/modules/data",
}: ModuleFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [height, setHeight] = useState(120)

  const srcDoc = useMemo(
    () => (bundleCode ? buildSandboxDocFromCode(bundleCode) : buildSandboxDoc(slug)),
    [slug, bundleCode]
  )

  useEffect(() => {
    if (!srcDoc) {
      setStatus("error")
      setErrorMsg("This module has no runtime bundle yet.")
      return
    }

    const theme: "light" | "dark" =
      typeof document !== "undefined" && document.documentElement.classList.contains("dark")
        ? "dark"
        : "light"

    function postToFrame(msg: HostInitMessage | HostResponseMessage) {
      iframeRef.current?.contentWindow?.postMessage(msg, "*")
    }

    async function relay(id: number, method: string, params: unknown) {
      // Defense-in-depth: gate on the client too (the route re-checks).
      if (!isRuntimeMethod(method)) {
        postToFrame({ source: "lingocon-host", type: "response", id, ok: false, error: "Unknown method" })
        return
      }
      const required = permissionForMethod(method)
      if (required && !permissions.includes(required)) {
        postToFrame({
          source: "lingocon-host",
          type: "response",
          id,
          ok: false,
          error: `Permission "${required}" not granted`,
        })
        return
      }
      try {
        const res = await fetch(dataUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ languageId, moduleId, method, params }),
        })
        const json = await res.json()
        if (!res.ok) {
          postToFrame({ source: "lingocon-host", type: "response", id, ok: false, error: json?.error || "Request failed" })
          return
        }
        postToFrame({ source: "lingocon-host", type: "response", id, ok: true, data: json.data })
      } catch {
        postToFrame({ source: "lingocon-host", type: "response", id, ok: false, error: "Network error" })
      }
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return
      const msg = event.data
      if (!isWidgetMessage(msg)) return

      switch (msg.type) {
        case "ready":
          setStatus("ready")
          postToFrame({
            source: "lingocon-host",
            type: "init",
            context: { moduleId: moduleId ?? "", languageSlug, languageId, permissions, theme },
          })
          break
        case "request":
          void relay(msg.id, msg.method, msg.params)
          break
        case "resize":
          if (typeof msg.height === "number" && msg.height > 0) {
            setHeight(Math.min(2000, Math.max(60, msg.height + 4)))
          }
          break
        case "error":
          setErrorMsg(msg.message)
          break
        case "download": {
          // The module already had permission to read this data; the host just
          // turns the string it produced into a file the user can save.
          const content = typeof msg.content === "string" ? msg.content : ""
          if (content.length > 5_000_000) return
          const safeName = (msg.filename || "export.txt")
            .replace(/[^\w.\-]+/g, "_")
            .slice(0, 100)
          const mime = typeof msg.mime === "string" ? msg.mime : "text/plain"
          const blob = new Blob([content], { type: `${mime};charset=utf-8` })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = safeName
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 1000)
          break
        }
      }
    }

    window.addEventListener("message", onMessage)
    const timeout = setTimeout(() => {
      setStatus((s) => (s === "loading" ? "error" : s))
    }, 8000)

    return () => {
      window.removeEventListener("message", onMessage)
      clearTimeout(timeout)
    }
  }, [srcDoc, moduleId, languageId, languageSlug, permissions, dataUrl])

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        {errorMsg || "This module failed to load."}
      </div>
    )
  }

  return (
    <div className="relative">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/50">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        title={slug}
        sandbox="allow-scripts"
        srcDoc={srcDoc ?? undefined}
        scrolling="no"
        className="w-full rounded-xl border-0 bg-transparent"
        style={{ height }}
      />
    </div>
  )
}
