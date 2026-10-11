/** Toolbar slots shown while the editor loads (the base toolbar's buttons and separators). */
const TOOLBAR_SLOTS = ["b", "i", "font", "|", "h1", "h2", "|", "ipa", "|", "ul", "ol", "quote", "|", "table"]

/**
 * The editor's frame — same border, toolbar row and minimum content height as the live editor —
 * shown until the editor's code has loaded and the editor exists, so the page does not jump
 * when it appears. Marked busy so assistive tech announces the region once it is ready.
 */
export function RichTextEditorSkeleton() {
    return (
        <div
            aria-busy="true"
            className="flex flex-col border rounded-xl overflow-hidden bg-card text-card-foreground shadow-sm"
        >
            <div className="flex items-center gap-1 p-2 border-b bg-secondary/30 flex-wrap">
                {TOOLBAR_SLOTS.map((slot, index) =>
                    slot === "|" ? (
                        <div key={index} className="w-px h-6 bg-border mx-1" />
                    ) : (
                        <div key={index} className="h-9 w-10 rounded-md bg-muted/50 animate-pulse" />
                    )
                )}
            </div>
            <div className="min-h-[300px]" />
        </div>
    )
}
