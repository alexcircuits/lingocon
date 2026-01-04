"use client"

import { Tour, TourStep } from "./tour"

const dashboardTourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to LingoCon!",
    description:
      "LingoCon is your platform for documenting and sharing constructed languages. Let's take a quick tour to get you started.",
    position: "center",
  },
  {
    id: "create-language",
    title: "Create Your First Language",
    description:
      "Start by creating a new language. Click 'New Language' to begin documenting your conlang with alphabet, grammar, dictionary, and more.",
    target: 'a[href="/dashboard/new-language"]',
    position: "right",
    action: {
      label: "Create Language",
      onClick: () => {
        window.location.href = "/dashboard/new-language"
      },
    },
  },
  {
    id: "browse",
    title: "Explore Languages",
    description:
      "Browse public languages created by the community. Discover inspiration and learn from other conlangers.",
    target: 'a[href="/browse"]',
    position: "right",
  },
  {
    id: "search",
    title: "Quick Search",
    description:
      "Use the search bar (Cmd+K) to quickly find languages, dictionary entries, or grammar pages across the platform.",
    target: 'button[aria-label*="Search"], input[placeholder*="Search"]',
    position: "bottom",
  },
]

export function DashboardTour() {
  return (
    <Tour
      steps={dashboardTourSteps}
      storageKey="dashboard-tour-completed"
      onComplete={() => {
        console.log("Dashboard tour completed")
      }}
    />
  )
}

