/**
 * Shared landing-page content. Single source of truth so the visible FAQ
 * section and the FAQPage JSON-LD structured data never drift apart.
 *
 * The actual copy lives in messages/<locale>.json under the `landing.faq`
 * and `landing.howItWorks` namespaces. Getter functions take a `next-intl`
 * translator and return the localized arrays in render order.
 */

type Translator = (key: string) => string

export interface FaqItem {
    question: string
    answer: string
}

export interface HowItWorksStep {
    step: string
    title: string
    description: string
}

const FAQ_KEYS = ["bestTool", "what", "howCreate", "isFree", "whatIs"] as const
const STEP_KEYS = ["create", "build", "share"] as const

export function getFaqItems(t: Translator): FaqItem[] {
    return FAQ_KEYS.map((key) => ({
        question: t(`faq.${key}.question`),
        answer: t(`faq.${key}.answer`),
    }))
}

export function getHowItWorksSteps(t: Translator): HowItWorksStep[] {
    return STEP_KEYS.map((key, i) => ({
        step: String(i + 1).padStart(2, "0"),
        title: t(`howItWorks.${key}.title`),
        description: t(`howItWorks.${key}.description`),
    }))
}
