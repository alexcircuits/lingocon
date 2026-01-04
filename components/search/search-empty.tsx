import { Search } from "lucide-react"

export function SearchEmpty() {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-500">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted/30">
                <Search className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">No results found</h3>
            <p className="mt-2 max-w-sm text-muted-foreground">
                We couldn&apos;t find anything matching your search. Try different keywords or browse our top languages.
            </p>
        </div>
    )
}
