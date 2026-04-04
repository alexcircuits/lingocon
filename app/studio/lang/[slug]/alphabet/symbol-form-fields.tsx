"use client"

import { Input } from "@/components/ui/input"
import { IPAInput } from "@/components/ui/ipa-input"
import { Label } from "@/components/ui/label"

export interface SymbolFormData {
  symbol: string
  capitalSymbol: string
  ipa: string
  latin: string
  name: string
}

interface SymbolFormFieldsProps {
  formData: SymbolFormData
  onChange: (data: SymbolFormData) => void
  isPending: boolean
  idPrefix: string
}

export function SymbolFormFields({ formData, onChange, isPending, idPrefix }: SymbolFormFieldsProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-symbol`}>Lowercase</Label>
          <Input
            id={`${idPrefix}-symbol`}
            value={formData.symbol}
            onChange={(e) =>
              onChange({ ...formData, symbol: e.target.value })
            }
            placeholder="a"
            required
            disabled={isPending}
            maxLength={10}
            className="text-lg font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-capital`}>Uppercase (optional)</Label>
          <Input
            id={`${idPrefix}-capital`}
            value={formData.capitalSymbol}
            onChange={(e) =>
              onChange({ ...formData, capitalSymbol: e.target.value })
            }
            placeholder="A"
            disabled={isPending}
            maxLength={10}
            className="text-lg font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-ipa`}>IPA (optional)</Label>
          <IPAInput
            id={`${idPrefix}-ipa`}
            value={formData.ipa}
            onChange={(value) =>
              onChange({ ...formData, ipa: value })
            }
            placeholder="/a/"
            disabled={isPending}
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-latin`}>Latin (optional)</Label>
          <Input
            id={`${idPrefix}-latin`}
            value={formData.latin}
            onChange={(e) =>
              onChange({ ...formData, latin: e.target.value })
            }
            placeholder="a"
            disabled={isPending}
            maxLength={10}
            className="font-mono"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name (optional)</Label>
        <Input
          id={`${idPrefix}-name`}
          value={formData.name}
          onChange={(e) =>
            onChange({ ...formData, name: e.target.value })
          }
          placeholder="Letter A"
          disabled={isPending}
          maxLength={200}
        />
      </div>
    </div>
  )
}
