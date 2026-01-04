"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Loader2, FileJson } from "lucide-react"
import { importLanguage } from "@/app/actions/import-language"
import { toast } from "sonner"

export function LanguageImportDialog() {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const router = useRouter()

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleImport = async () => {
        if (!file) return

        setIsLoading(true)

        try {
            const text = await file.text()
            const result = await importLanguage(text)

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(`Successfully imported ${result.data?.name} with ${result.count} entries`)
                setOpen(false)
                setFile(null)
                router.refresh()
            }
        } catch (error) {
            toast.error("An error occurred during import")
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Import JSON
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Import Language</DialogTitle>
                    <DialogDescription>
                        Upload a JSON file containing your language data.
                        <br /><br />
                        Having trouble? Send your JSON file to <a href="mailto:support@noirsystems.com" className="text-primary hover:underline">support@noirsystems.com</a> and we will help you import it.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="file">Language File</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="file"
                                type="file"
                                accept=".json"
                                onChange={handleFileChange}
                                disabled={isLoading}
                            />
                        </div>
                        {file && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <FileJson className="h-3 w-3" />
                                {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            </p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleImport} disabled={!file || isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Import
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
