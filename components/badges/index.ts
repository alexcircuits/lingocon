export { BadgeCard, BadgeIcon, type BadgeData, type BadgeTier, type BadgeCategory } from "./badge-card"
export { BadgeGrid } from "./badge-grid"
export { BadgeShowcase, BadgeProgress } from "./badge-showcase"
// The achievement toast is deliberately not re-exported: server pages import this barrel, and
// every client module it re-exports joins their bundle — the toast brought the animation
// library (~42 kB) onto the dashboard and profile pages. Import it from its own module.
export { useAchievementToast } from "./use-achievement-toast"
