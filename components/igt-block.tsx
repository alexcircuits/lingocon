"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface IGTBlockProps {
  sentence: string
  gloss: string
  translation: string
  onEdit?: (data: { sentence: string; gloss: string; translation: string }) => void
  editable?: boolean
}

export function IGTBlock({ sentence, gloss, translation, onEdit, editable = false }: IGTBlockProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editSentence, setEditSentence] = useState(sentence)
  const [editGloss, setEditGloss] = useState(gloss)
  const [editTranslation, setEditTranslation] = useState(translation)

  const handleSave = () => {
    if (onEdit) {
      onEdit({
        sentence: editSentence,
        gloss: editGloss,
        translation: editTranslation,
      })
    }
    setIsOpen(false)
  }

  return (
    <div className="my-4">
      {editable && onEdit ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Card className="p-4 cursor-pointer hover:bg-accent transition-colors">
              <div className="font-mono text-lg">{sentence || "(empty)"}</div>
              <div className="font-mono text-sm text-muted-foreground mt-1">
                {gloss || "(empty)"}
              </div>
              <div className="text-sm italic mt-2">{translation || "(empty)"}</div>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit IGT Block</DialogTitle>
              <DialogDescription>
                Interlinear Glossed Text: sentence, morpheme gloss, and translation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="igt-sentence">Sentence</Label>
                <Input
                  id="igt-sentence"
                  value={editSentence}
                  onChange={(e) => setEditSentence(e.target.value)}
                  placeholder="Native script sentence"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="igt-gloss">Gloss</Label>
                <Input
                  id="igt-gloss"
                  value={editGloss}
                  onChange={(e) => setEditGloss(e.target.value)}
                  placeholder="Morpheme-by-morpheme gloss"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="igt-translation">Translation</Label>
                <Input
                  id="igt-translation"
                  value={editTranslation}
                  onChange={(e) => setEditTranslation(e.target.value)}
                  placeholder="Free translation"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Card className="p-4">
          <div className="font-mono text-lg">{sentence || "(empty)"}</div>
          <div className="font-mono text-sm text-muted-foreground mt-1">
            {gloss || "(empty)"}
          </div>
          <div className="text-sm italic mt-2">{translation || "(empty)"}</div>
        </Card>
      )}
    </div>
  )
}

