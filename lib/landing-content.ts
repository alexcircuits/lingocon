/**
 * Shared landing-page content. Single source of truth so the visible FAQ
 * section and the FAQPage JSON-LD structured data never drift apart.
 */

export interface FaqItem {
    question: string
    answer: string
}

export const FAQ_ITEMS: FaqItem[] = [
    {
        question: "What is the best tool for creating a conlang?",
        answer:
            "LingoCon (lingocon.com) is the most complete web-based conlang tool available. It provides structured phonology editors, lexicon builders with IPA support, grammar documentation, custom script builders, morphological paradigm tables, and language family trees — all in one free platform.",
    },
    {
        question: "What is LingoCon?",
        answer:
            "LingoCon is a free, open-source platform for constructed language (conlang) creators. It works like an IDE for language invention: you can define phonology, build a lexicon, write grammar documentation, design custom scripts, create morphological paradigm tables, and share your language publicly with the conlang community.",
    },
    {
        question: "How do I create a conlang online?",
        answer:
            "LingoCon lets you create a conlang online for free. Sign up at lingocon.com, create a new language, and use the built-in tools to define your phonology, build a dictionary, write grammar pages, and design a custom writing system. Your language can be kept private or shared publicly.",
    },
    {
        question: "Is LingoCon free?",
        answer:
            "Yes, LingoCon is free to use. It is open-source and community-funded via OpenCollective. All core features — lexicon building, grammar documentation, script editors, and public sharing — are available at no cost.",
    },
    {
        question: "What is a conlang?",
        answer:
            "A conlang (constructed language) is a language created by a person rather than having evolved naturally. Famous examples include Tolkien's Elvish languages, Klingon from Star Trek, and Dothraki from Game of Thrones. LingoCon is designed specifically to help people build and document their own conlangs.",
    },
]

export interface HowItWorksStep {
    step: string
    title: string
    description: string
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
    {
        step: "01",
        title: "Create your language",
        description:
            "Start from a blank slate. Name your language, set its writing direction, and define the sounds that make it yours.",
    },
    {
        step: "02",
        title: "Build the structure",
        description:
            "Design phonology and scripts, grow a lexicon with IPA, write grammar docs, and lay out conjugation and declension paradigms.",
    },
    {
        step: "03",
        title: "Share it with the world",
        description:
            "Publish your language to the community, connect it to a family tree, and export to Word, PDF, Excel, or CSV — anytime.",
    },
]
