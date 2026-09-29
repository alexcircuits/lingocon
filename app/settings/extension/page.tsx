"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { Copy, Plus, Trash2, CheckCheck, Puzzle, Clock, ShieldCheck } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Token {
  id: string
  name: string | null
  lastUsedAt: string | null
  expiresAt: string
  createdAt: string
}

export default function ExtensionSettingsPage() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/ext/tokens")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTokens(data.tokens ?? [])
    } catch {
      toast.error("Failed to load tokens")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  async function generateToken() {
    setGenerating(true)
    try {
      const res = await fetch("/api/ext/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Browser Extension ${new Date().toLocaleDateString()}` }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNewToken(data.token)
      await fetchTokens()
    } catch {
      toast.error("Failed to generate token")
    } finally {
      setGenerating(false)
    }
  }

  async function copyToken() {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken)
    setCopied(true)
    toast.success("Token copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  async function revokeToken(id: string) {
    setRevoking(id)
    try {
      const res = await fetch("/api/ext/token", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast.success("Token revoked")
      await fetchTokens()
    } catch {
      toast.error("Failed to revoke token")
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center gap-3">
        <Puzzle className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold">Browser Extension</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect the LingoCon Translate extension to your account
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Generate a token here, then paste it into the LingoCon Translate extension settings.
            The token gives the extension read-only access to your dictionary and script data.
          </p>
          <p>
            Tokens are shown once and expire after 90 days. You can revoke any token at any time.
          </p>
        </CardContent>
      </Card>

      {newToken && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-base text-green-700 dark:text-green-400">
              Your new token
            </CardTitle>
            <CardDescription>
              Copy this token now — it will not be shown again.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono text-xs break-all select-all">
              {newToken}
            </div>
            <Button
              onClick={copyToken}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {copied ? (
                <>
                  <CheckCheck className="h-4 w-4 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy token
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Active tokens</h2>
          <Button
            onClick={generateToken}
            disabled={generating}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {generating ? "Generating…" : "New token"}
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
        ) : tokens.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No active tokens. Generate one to connect the extension.
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between rounded-md border px-4 py-3 gap-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {token.name ?? "Extension token"}
                    </span>
                    <Badge variant="secondary" className="text-xs shrink-0">active</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {token.lastUsedAt
                        ? `Used ${formatDistanceToNow(new Date(token.lastUsedAt), { addSuffix: true })}`
                        : "Never used"}
                    </span>
                    <Separator orientation="vertical" className="h-3" />
                    <span>
                      Expires {formatDistanceToNow(new Date(token.expiresAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      disabled={revoking === token.id}
                      aria-label="Revoke token"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke token?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The extension will be disconnected immediately. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => revokeToken(token.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Revoke
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
