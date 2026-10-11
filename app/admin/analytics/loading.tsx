export default function AdminAnalyticsLoading() {
    return (
        <div className="p-4 md:p-8 space-y-6" aria-busy="true">
            <div className="h-16 w-64 bg-muted rounded-xl animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-80 bg-muted rounded-xl animate-pulse" />
                ))}
            </div>
        </div>
    )
}
