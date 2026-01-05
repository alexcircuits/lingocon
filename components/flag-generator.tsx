"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Palette, RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"

type Layout =
    | "horizontal_2"
    | "horizontal_3"
    | "vertical_2"
    | "vertical_3"
    | "cross"
    | "nordic"
    | "saltire"
    | "border"
    | "canton"

interface FlagGeneratorProps {
    onSave: (url: string) => void
    languageName: string
}

export function FlagGenerator({ onSave, languageName }: FlagGeneratorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [layout, setLayout] = useState<Layout>("horizontal_3")
    const [colors, setColors] = useState<string[]>(["#0055A4", "#FFFFFF", "#EF4135"]) // Default French-like for 3 stripes
    const [isSaving, setIsSaving] = useState(false)
    const svgRef = useRef<SVGSVGElement>(null)

    const handleLayoutChange = (newLayout: Layout) => {
        setLayout(newLayout)
        // Adjust colors array based on layout needs
        if (newLayout.includes("_2")) setColors(prev => [prev[0], prev[1]])
        else if (newLayout.includes("_3")) setColors(prev => [prev[0], prev[1], prev[2] || "#000000"])
        else if (newLayout === "cross" || newLayout === "nordic" || newLayout === "saltire" || newLayout === "border" || newLayout === "canton") {
            setColors(prev => [prev[0], prev[1]])
        }
    }

    const generateRandomColors = () => {
        const randomHex = () => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")
        const count = layout.includes("_3") ? 3 : 2
        const newColors = Array.from({ length: count }, () => randomHex())
        setColors(newColors)
    }

    const updateColor = (index: number, color: string) => {
        const newColors = [...colors]
        newColors[index] = color
        setColors(newColors)
    }

    const renderFlag = () => {
        const width = 300
        const height = 200

        switch (layout) {
            case "horizontal_2":
                return (
                    <>
                        <rect width={width} height={height / 2} fill={colors[0]} />
                        <rect y={height / 2} width={width} height={height / 2} fill={colors[1]} />
                    </>
                )
            case "horizontal_3":
                return (
                    <>
                        <rect width={width} height={height / 3} fill={colors[0]} />
                        <rect y={height / 3} width={width} height={height / 3} fill={colors[1]} />
                        <rect y={(height / 3) * 2} width={width} height={height / 3} fill={colors[2]} />
                    </>
                )
            case "vertical_2":
                return (
                    <>
                        <rect width={width / 2} height={height} fill={colors[0]} />
                        <rect x={width / 2} width={width / 2} height={height} fill={colors[1]} />
                    </>
                )
            case "vertical_3":
                return (
                    <>
                        <rect width={width / 3} height={height} fill={colors[0]} />
                        <rect x={width / 3} width={width / 3} height={height} fill={colors[1]} />
                        <rect x={(width / 3) * 2} width={width / 3} height={height} fill={colors[2]} />
                    </>
                )
            case "cross":
                return (
                    <>
                        <rect width={width} height={height} fill={colors[0]} />
                        <rect x={width / 2 - 15} width="30" height={height} fill={colors[1]} />
                        <rect y={height / 2 - 15} width={width} height="30" fill={colors[1]} />
                    </>
                )
            case "nordic":
                return (
                    <>
                        <rect width={width} height={height} fill={colors[0]} />
                        <rect x={80} width="30" height={height} fill={colors[1]} />
                        <rect y={85} width={width} height="30" fill={colors[1]} />
                    </>
                )
            case "saltire":
                return (
                    <>
                        <rect width={width} height={height} fill={colors[0]} />
                        <line x1="0" y1="0" x2={width} y2={height} stroke={colors[1]} strokeWidth="30" />
                        <line x1={width} y1="0" x2="0" y2={height} stroke={colors[1]} strokeWidth="30" />
                    </>
                )
            case "border":
                return (
                    <>
                        <rect width={width} height={height} fill={colors[1]} />
                        <rect x="20" y="20" width={width - 40} height={height - 40} fill={colors[0]} />
                    </>
                )
            case "canton":
                return (
                    <>
                        <rect width={width} height={height} fill={colors[0]} />
                        <rect width={width / 2} height={height / 2} fill={colors[1]} />
                    </>
                )
            default:
                return <rect width={width} height={height} fill="#EEE" />
        }
    }

    const handleSave = async () => {
        if (!svgRef.current) return
        setIsSaving(true)

        try {
            // 1. Convert SVG to Blob
            const svgData = new XMLSerializer().serializeToString(svgRef.current)
            const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
            const fileName = `${languageName.toLowerCase().replace(/\s+/g, "-")}-flag.svg`
            const file = new File([svgBlob], fileName, { type: "image/svg+xml" })

            // 2. Upload using existing API
            const formData = new FormData()
            formData.append("file", file)
            formData.append("type", "flag")

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) throw new Error("Upload failed")

            const data = await response.json()
            onSave(data.url)
            setIsOpen(false)
            toast.success("Flag generated and saved!")
        } catch (error) {
            console.error(error)
            toast.error("Failed to save flag")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Palette className="h-4 w-4" />
                    Design Flag
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Flag Generator</DialogTitle>
                    <DialogDescription>
                        Create a custom flag for {languageName}. Pick a layout and colors.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="flex justify-center bg-muted/30 rounded-lg p-6 border border-dashed">
                        <svg
                            ref={svgRef}
                            width="300"
                            height="200"
                            viewBox="0 0 300 200"
                            className="rounded shadow-lg"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            {renderFlag()}
                        </svg>
                    </div>

                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label>Layout Pattern</Label>
                            <Select value={layout} onValueChange={(v: Layout) => handleLayoutChange(v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a layout" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="horizontal_2">Two Horizontal Stripes</SelectItem>
                                    <SelectItem value="horizontal_3">Three Horizontal Stripes</SelectItem>
                                    <SelectItem value="vertical_2">Two Vertical Stripes</SelectItem>
                                    <SelectItem value="vertical_3">Three Vertical Stripes</SelectItem>
                                    <SelectItem value="cross">Central Cross</SelectItem>
                                    <SelectItem value="nordic">Nordic Cross</SelectItem>
                                    <SelectItem value="saltire">Saltire (X-Cross)</SelectItem>
                                    <SelectItem value="border">Bordered</SelectItem>
                                    <SelectItem value="canton">Canton (Top-Left)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Colors</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={generateRandomColors}
                                    className="h-7 gap-1.5 text-xs"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    Randomize
                                </Button>
                            </div>
                            <div className="flex gap-4">
                                {colors.map((color, idx) => (
                                    <div key={idx} className="flex flex-col items-center gap-1">
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => updateColor(idx, e.target.value)}
                                            className="h-10 w-10 cursor-pointer rounded border-none bg-transparent"
                                        />
                                        <span className="text-[10px] text-muted-foreground">Color {idx + 1}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                        {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save & Apply
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
