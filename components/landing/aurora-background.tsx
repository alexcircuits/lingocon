/**
 * Soft, animated multi-colour blobs + faint grid used as section backgrounds
 * across the Aurora landing. Purely decorative.
 */
export function AuroraBackground({
    variant = "default",
    grid = true,
}: {
    variant?: "default" | "hero" | "subtle"
    grid?: boolean
}) {
    return (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            {grid && (
                <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_40%,black,transparent)] bg-[linear-gradient(to_right,hsl(var(--foreground)/0.04)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground)/0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />
            )}

            {/* Violet */}
            <div
                className="aurora-blob aurora-blob-animate"
                style={{
                    top: variant === "hero" ? "-10%" : "-15%",
                    left: "-5%",
                    width: "45%",
                    height: "45%",
                    background:
                        "radial-gradient(circle at center, hsl(var(--aurora-violet)/0.9), transparent 70%)",
                }}
            />
            {/* Blue */}
            <div
                className="aurora-blob aurora-blob-animate"
                style={{
                    top: variant === "hero" ? "0%" : "10%",
                    right: "-8%",
                    width: "42%",
                    height: "42%",
                    background:
                        "radial-gradient(circle at center, hsl(var(--aurora-blue)/0.8), transparent 70%)",
                    animationDelay: "-6s",
                }}
            />
            {/* Magenta / mint accent (hero only, livelier) */}
            {variant === "hero" && (
                <>
                    <div
                        className="aurora-blob aurora-blob-animate"
                        style={{
                            bottom: "-10%",
                            left: "25%",
                            width: "40%",
                            height: "40%",
                            background:
                                "radial-gradient(circle at center, hsl(var(--aurora-magenta)/0.6), transparent 70%)",
                            animationDelay: "-12s",
                        }}
                    />
                    <div
                        className="aurora-blob aurora-blob-animate"
                        style={{
                            top: "20%",
                            left: "40%",
                            width: "30%",
                            height: "30%",
                            background:
                                "radial-gradient(circle at center, hsl(var(--aurora-mint)/0.5), transparent 70%)",
                            animationDelay: "-3s",
                        }}
                    />
                </>
            )}
        </div>
    )
}
