"use client"

import { Tour, TourStep } from "./tour"

const studioTourSteps: TourStep[] = [
  {
    id: "overview",
    title: "Language Studio Overview",
    description:
      "This is your language studio where you can manage all aspects of your language. The sidebar shows quick stats and navigation.",
    target: "aside",
    position: "right",
  },
  {
    id: "dictionary",
    title: "Build Your Dictionary",
    description:
      "Add words to your dictionary with translations, IPA pronunciation, and part of speech. Use bulk import for faster entry.",
    target: 'a[href*="/dictionary"]',
    position: "right",
    action: {
      label: "Go to Dictionary",
      onClick: () => {
        const link = document.querySelector('a[href*="/dictionary"]') as HTMLAnchorElement
        link?.click()
      },
    },
  },
  {
    id: "grammar",
    title: "Document Grammar",
    description:
      "Create grammar pages to document your language's structure, syntax, and rules. Organize them into chapters.",
    target: 'a[href*="/grammar"]',
    position: "right",
  },
  {
    id: "alphabet",
    title: "Define Your Alphabet",
    description:
      "Set up your writing system by adding script symbols with IPA equivalents and transliteration.",
    target: 'a[href*="/alphabet"]',
    position: "right",
  },
  {
    id: "quick-actions",
    title: "Quick Actions",
    description:
      "Use keyboard shortcuts to work faster: Cmd+N for new entry, Cmd+/ for shortcuts help, Esc to close dialogs.",
    position: "center",
  },
]

export function StudioTour() {
  return (
    <Tour
      steps={studioTourSteps}
      storageKey="studio-tour-completed"
      onComplete={() => {
        console.log("Studio tour completed")
      }}
    />
  )
}

