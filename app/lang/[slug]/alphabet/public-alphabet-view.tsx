"use client"

import { IPASpeaker } from "@/components/ipa-speaker"
import type { ScriptSymbol } from "@prisma/client"

interface PublicAlphabetViewProps {
  symbols: ScriptSymbol[]
}

export function PublicAlphabetView({ symbols }: PublicAlphabetViewProps) {
  if (symbols.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          No script symbols have been added yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {symbols.map((symbol) => (
          <div
            key={symbol.id}
            className="rounded-lg border p-6 text-center transition-colors hover:bg-accent/50"
          >
            <div className="text-4xl font-bold mb-2 flex items-center justify-center gap-1">
              {symbol.capitalSymbol ? (
                <>
                  <span>{symbol.capitalSymbol}</span>
                  <span>{symbol.symbol}</span>
                </>
              ) : (
                <span>{symbol.symbol}</span>
              )}
              {symbol.latin && symbol.latin !== symbol.symbol && (
                <>
                  <span className="text-muted-foreground/30 mx-1">/</span>
                  <span className="text-2xl text-muted-foreground">{symbol.latin}</span>
                </>
              )}
            </div>
            {symbol.ipa && (
              <div className="text-sm text-muted-foreground mb-1 flex items-center justify-center gap-2">
                <span>/{symbol.ipa}/</span>
                <IPASpeaker ipa={symbol.ipa} size="sm" />
              </div>
            )}
            {symbol.name && (
              <div className="text-sm font-medium">{symbol.name}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

