import { auth } from "@/auth"
import { unstable_cache } from "next/cache"
import { getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  ArrowRight,
  Github,
  Construction,
  Heart,
  Globe,
  Map,
  Sparkles,
} from "lucide-react"
import { FeaturedLanguages } from "@/components/featured-languages"
import { Navbar } from "@/components/navbar"
import { TopLanguagesStripe } from "@/components/top-languages-stripe"
import { MagneticButton } from "@/components/ui/magnetic-button"
import { Footer } from "@/components/footer"
import { WordOfTheDay } from "@/components/word-of-the-day"
import { SurveyBanner } from "@/components/survey-banner"
import { UniverseMapLazy } from "@/components/landing/universe-map-lazy"
import { HeroSocialProof } from "@/components/landing/hero-social-proof"
import { HowItWorks } from "@/components/landing/how-it-works"
import { FaqSection } from "@/components/landing/faq-section"
import { getFaqItems, getHowItWorksSteps, type FaqItem } from "@/lib/landing-content"
import { StudioDemo } from "@/components/landing/studio-demo/studio-demo"
import { AuroraBackground } from "@/components/landing/aurora-background"
import { FeatureBento } from "@/components/landing/feature-bento"
import { UseCases } from "@/components/landing/use-cases"
import { CommunityGlobe } from "@/components/landing/community-globe"
// import { TestimonialsMarquee } from "@/components/landing/testimonials-marquee"

import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/seo"

export const metadata: Metadata = {
  title: "LingoCon — #1 Conlang Tool & Constructed Language Platform",
  description: "The most complete free platform for creating constructed languages. Build lexicons, write grammar docs, design custom scripts, and share your conlang with the world. Free forever.",
  keywords: [
    "conlang tool", "conlang maker", "conlang builder", "conlang creator", "best conlang tool",
    "constructed language tool", "constructed language maker", "create a conlang",
    "conlang platform", "conlang software", "conlang documentation", "conlang community",
    "fictional language maker", "invented language tool", "worldbuilding language tool",
    "free conlang tool", "online conlang maker",
  ],
  openGraph: {
    title: "LingoCon — #1 Conlang Tool & Constructed Language Platform",
    description: "The most complete free platform for creating constructed languages. Phonology, lexicon, grammar docs, custom scripts, and language family trees — all in one place.",
  },
  alternates: {
    canonical: getSiteUrl(),
  },
}

const siteUrl = getSiteUrl()

function JsonLd({ faqItems }: { faqItems: FaqItem[] }) {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "LingoCon",
    url: siteUrl,
    description: "The platform for conlang creators. Build lexicons, write grammar documentation, and share your constructed languages with the world.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LingoCon",
    url: siteUrl,
    logo: `${siteUrl}/icons/icon-512.png`,
    founder: {
      "@type": "Person",
      name: "Alexander Chepkov",
      url: "https://github.com/alexcircuits",
    },
    sameAs: [
      "https://discord.gg/EaVRggatDQ",
      "https://github.com/alexcircuits/lingocon",
      "https://opencollective.com/lingocon",
    ],
  }

  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LingoCon",
    url: siteUrl,
    applicationCategory: "EducationalApplication",
    applicationSubCategory: "Language Tools",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: "The most complete web-based conlang tool. Create and document constructed languages with phonology editors, lexicon builders, grammar documentation, custom scripts, morphological paradigm tables, and language family trees.",
    featureList: [
      "Phonology and sound inventory editor",
      "Custom script and alphabet builder",
      "Dictionary and lexicon manager with IPA support",
      "Rich text grammar documentation",
      "Morphological paradigm tables",
      "Interlinear glossing for example texts",
      "Sound change documentation",
      "Language family tree visualization",
      "Spaced repetition flashcards",
      "Multi-user collaboration",
      "Export to Excel, Word, PDF, CSV",
      "Real-time completeness analytics",
      "Public language sharing and community",
    ],
    creator: {
      "@type": "Person",
      name: "Alexander Chepkov",
      url: "https://github.com/alexcircuits",
    },
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  )
}


const getFeaturedLanguages = unstable_cache(async () => {
  const languages = await prisma.language.findMany({
    where: {
      visibility: "PUBLIC",
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      _count: {
        select: {
          scriptSymbols: true,
          grammarPages: true,
          dictionaryEntries: true,
          favorites: true,
        },
      },
    },
    orderBy: [
      { favorites: { _count: "desc" } },
      { dictionaryEntries: { _count: "desc" } },
      { updatedAt: "desc" },
    ],
    take: 6,
  })

  return languages
}, ["landing-featured-languages"], { revalidate: 300, tags: ["languages"] })

const getTopLanguages = unstable_cache(async () => {
  const languages = await prisma.language.findMany({
    where: {
      visibility: "PUBLIC",
    },
    include: {
      _count: {
        select: {
          favorites: true,
        },
      },
    },
    orderBy: [
      { favorites: { _count: "desc" } },
      { dictionaryEntries: { _count: "desc" } },
    ],
    take: 10,
  })

  return languages
}, ["landing-top-languages"], { revalidate: 300, tags: ["languages"] })

const getUniverseLanguages = unstable_cache(async () => {
  return prisma.language.findMany({
    where: { visibility: "PUBLIC" },
    select: {
      id: true,
      name: true,
      slug: true,
      flagUrl: true,
      parentLanguageId: true,
      // Must match the /families query so both maps render the same graph
      externalAncestry: true,
      familyId: true,
      family: { select: { id: true, name: true } },
      owner: { select: { name: true } },
      _count: { select: { dictionaryEntries: true } }
    }
  })
}, ["landing-universe-languages"], { revalidate: 300, tags: ["languages"] })

const getStats = unstable_cache(async () => {
  const [languageCount, wordCount, userCount, grammarCount] = await Promise.all([
    prisma.language.count(),
    prisma.dictionaryEntry.count(),
    prisma.user.count(),
    prisma.grammarPage.count(),
  ])
  return { languageCount, wordCount, userCount, grammarCount }
}, ["landing-stats"], { revalidate: 300, tags: ["languages"] })

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    className={className}
  >
    <title>Discord</title>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.176 2.419 0 1.334-.965 2.419-2.176 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.176 2.419 0 1.334-.966 2.419-2.176 2.419z" />
  </svg>
)

export default async function Home() {
  const t = await getTranslations("landing");
  const faqItems = getFaqItems(t)
  const howItWorksSteps = getHowItWorksSteps(t)
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"
  const [featuredLanguages, topLanguages, universeLanguages, stats] = await Promise.all([
    getFeaturedLanguages(),
    getTopLanguages(),
    getUniverseLanguages(),
    getStats(),
  ])
  const isAuthenticated = session || isDevMode

  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  } : null

  return (
    <main className="landing-aurora font-display min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20">
      <JsonLd faqItems={faqItems} />
      <Navbar user={user} isDevMode={isDevMode} />

      {/* ═══════════════════════════════════════════════════════════
          HERO — Aurora + real interactive studio demo
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden px-4 pt-28 pb-16 md:pt-36 md:pb-24">
        <AuroraBackground variant="hero" />

        <div className="container relative z-10 mx-auto max-w-7xl">
          {/* Eyebrow */}
          <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("eyebrow")}
            </span>
          </div>

          {/* Headline */}
          <h1 className="mx-auto mt-8 max-w-5xl text-center text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl md:text-7xl lg:text-[5.5rem] animate-in fade-in slide-in-from-bottom-4 duration-700">
            {t("headline")}
            <br />
            <span className="aurora-gradient-text">{t("headlineAccent")}</span>
          </h1>

          {/* Subhead */}
          <p className="mx-auto mt-7 max-w-2xl text-center text-lg text-muted-foreground sm:text-xl md:text-2xl animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150">
            {t("subhead")}
          </p>

          {/* CTAs */}
          <div className="mx-auto mt-9 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <Link href={isAuthenticated ? "/dashboard" : "/login"} className="block w-full sm:w-auto">
              <MagneticButton className="h-14 w-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--aurora-blue))] px-8 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:scale-105 sm:w-auto">
                {isAuthenticated ? t("ctaDashboard") : t("ctaPrimary")}
                <ArrowRight className="ml-2 h-5 w-5 pointer-events-none" />
              </MagneticButton>
            </Link>
            <Link href="/browse" className="block w-full sm:w-auto">
              <MagneticButton
                variant="outline"
                className="h-14 w-full rounded-full border-2 border-border bg-card/50 px-8 text-base font-semibold backdrop-blur-md transition-all hover:border-primary/40 sm:w-auto"
              >
                <Globe className="mr-2 h-5 w-5 pointer-events-none" />
                {t("ctaExplore")}
              </MagneticButton>
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-7 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
            <HeroSocialProof
              languageCount={stats.languageCount}
              wordCount={stats.wordCount}
              userCount={stats.userCount}
            />
          </div>

          {/* Interactive studio demo — the real product (desktop only) */}
          <div className="relative mx-auto mt-16 hidden max-w-6xl md:mt-20 md:block">
            <div className="aurora-ring-glow relative rounded-[24px]">
              <StudioDemo />
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t("editorNote")}
            </p>
          </div>

          {/* Trending stripe */}
          <div className="mt-20 border-t border-border/50 pt-12">
            <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
              {t("trendingLabel")}
            </p>
            <TopLanguagesStripe languages={topLanguages} />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FEATURES — big asymmetric bento
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden px-4 py-24">
        <AuroraBackground variant="subtle" grid={false} />
        <div className="container relative z-10 mx-auto max-w-6xl">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <Badge variant="outline" className="mb-5 rounded-full border-primary/20 bg-primary/5 px-4 py-1.5 text-xs uppercase tracking-widest text-primary">
              The toolkit
            </Badge>
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
              Everything you need to <span className="aurora-gradient-text">create</span>
            </h2>
            <p className="mx-auto mt-5 text-lg text-muted-foreground md:text-xl">
              From phonology to syntax — structured, connected tools that adapt to whatever
              your language wants to become.
            </p>
          </div>

          <FeatureBento />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          USE CASES
          ═══════════════════════════════════════════════════════════ */}
      <section className="px-4 pb-24">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              Built for whatever you&apos;re <span className="aurora-gradient-text">creating</span>
            </h2>
            <p className="mx-auto mt-4 text-lg text-muted-foreground">
              From sprawling fantasy worlds to serious linguistic study.
            </p>
          </div>
          <UseCases />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          COMMUNITY GLOBE
          ═══════════════════════════════════════════════════════════ */}
      <section className="px-4 py-24">
        <CommunityGlobe
          languageCount={stats.languageCount}
          wordCount={stats.wordCount}
          userCount={stats.userCount}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════
          HOW IT WORKS — 3 Steps
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-xs uppercase tracking-widest border-primary/20 bg-primary/5 text-primary">
              How it works
            </Badge>
            <h2 className="text-3xl md:text-4xl font-serif mb-4">
              From idea to living language
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Three steps from a blank page to a documented, shareable conlang.
            </p>
          </div>
          <HowItWorks steps={howItWorksSteps} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          UNIVERSE MAP — Full-Bleed "Wow" Moment
          ═══════════════════════════════════════════════════════════ */}
      {universeLanguages.length > 0 && (
        <section className="py-24 relative overflow-hidden font-display">
          <AuroraBackground variant="subtle" />
          <div className="container mx-auto px-4 relative">
            <div className="text-center mb-12">
              <Badge variant="outline" className="text-xs uppercase tracking-widest border-primary/20 bg-primary/5 text-primary mb-4">
                Interactive Map
              </Badge>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
                Explore the <span className="aurora-gradient-text">LingoCon Universe</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Every node is a language. Every connection is a family tree. Discover the constellation of constructed languages being built right now.
              </p>
            </div>
            <div className="max-w-6xl mx-auto">
              <UniverseMapLazy languages={universeLanguages} />
            </div>
            <div className="text-center mt-8 hidden md:block">
              <Link href="/browse">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full border-2 border-border bg-card/50 backdrop-blur-md hover:border-primary/40 gap-2"
                >
                  <Map className="w-4 h-4" />
                  Browse All Languages
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          WORD OF THE DAY
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-secondary/30 border-y border-border/40">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-5xl mx-auto">
            <div className="text-center lg:text-left">
              <Badge variant="outline" className="mb-4 text-xs uppercase tracking-widest border-primary/20 bg-primary/5 text-primary">
                Living lexicons
              </Badge>
              <h2 className="text-3xl md:text-4xl font-serif mb-4">
                Word of the Day
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                Every word here was invented and defined by a member of the community —
                complete with IPA, part of speech, and its own writing system. A small window
                into the worlds being built on LingoCon.
              </p>
              <Link href="/browse" className="inline-flex items-center gap-2 text-primary font-medium hover:gap-3 transition-all">
                Discover more languages
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="w-full max-w-lg mx-auto lg:mx-0">
              <WordOfTheDay />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FEATURED LANGUAGES
          ═══════════════════════════════════════════════════════════ */}
      {
        featuredLanguages.length > 0 && (
          <section className="py-24 bg-background">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-serif mb-4">
                  Made with LingoCon
                </h2>
                <p className="text-muted-foreground text-lg">
                  Explore languages created by our community
                </p>
              </div>
              <FeaturedLanguages languages={featuredLanguages} />
            </div>
          </section>
        )
      }

      {/* ═══════════════════════════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════════════════════════ */}
      {/*
      <section className="overflow-hidden px-4 py-24">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <Badge variant="outline" className="mb-5 rounded-full border-primary/20 bg-primary/5 px-4 py-1.5 text-xs uppercase tracking-widest text-primary">
              Loved by conlangers
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              From spreadsheets to <span className="aurora-gradient-text">storyworlds</span>
            </h2>
          </div>
        </div>
        <TestimonialsMarquee />
      </section>
      */}

      {/* ═══════════════════════════════════════════════════════════
          CONTRIBUTOR CALLOUT — Community & Open Source
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-16 border-y border-border/40 bg-secondary/20">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-serif font-medium mb-3 flex items-center justify-center md:justify-start gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              Looking for contributors
            </h3>
            <p className="text-muted-foreground font-light text-lg">
              Help us build the future of conlanging. Join our open source community.
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link href="https://github.com/alexcircuits/lingocon" target="_blank">
              <Button variant="outline" size="lg" className="gap-2 h-12 px-6 rounded-full border-primary/20 bg-background/50 hover:bg-secondary/50">
                <Github className="w-4 h-4" />
                Star on GitHub
              </Button>
            </Link>
            <Link href="/contributions">
              <Button size="lg" variant="secondary" className="gap-2 h-12 px-6 rounded-full shadow-sm hover:bg-secondary/80">
                <Construction className="w-5 h-5" />
                How to Contribute
              </Button>
            </Link>
            <Link href="https://discord.gg/EaVRggatDQ" target="_blank">
              <Button size="lg" className="gap-2 h-12 px-6 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white border-0 shadow-lg shadow-[#5865F2]/20">
                <DiscordIcon className="w-5 h-5" />
                Join Discord
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FAQ — Visible (shares data with JSON-LD)
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 text-xs uppercase tracking-widest border-primary/20 bg-primary/5 text-primary">
              FAQ
            </Badge>
            <h2 className="text-3xl md:text-4xl font-serif mb-4">
              Questions, answered
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Everything you need to know about building languages with LingoCon.
            </p>
          </div>
          <FaqSection items={faqItems} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SUPPORT STRIP — Demoted, warm
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-10 bg-rose-500/5 border-y border-rose-500/10">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/20">
              <Heart className="h-5 w-5 fill-rose-500/20" />
            </span>
            <p className="text-muted-foreground font-light max-w-md">
              LingoCon is free and community-funded. Help keep the servers running for every conlanger on earth.
            </p>
          </div>
          <Link href="/donate" className="shrink-0">
            <Button className="rounded-full h-11 px-6 bg-rose-500 hover:bg-rose-600 text-white gap-2 shadow-lg shadow-rose-500/20 transition-all hover:scale-105">
              <Heart className="w-4 h-4 fill-current" />
              Support on OpenCollective
            </Button>
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FINAL CTA — Reconvert to Signup
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-28 bg-foreground text-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,hsl(var(--primary)/0.25),transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,black,transparent)] bg-[linear-gradient(to_right,hsl(var(--background)/0.06)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--background)/0.06)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
          <h2 className="text-4xl md:text-6xl font-serif mb-6 tracking-tight leading-[1.05]">
            Your world is waiting <br />
            <span className="italic text-background/60">for its first word.</span>
          </h2>
          <p className="text-lg md:text-xl text-background/70 mb-10 font-light max-w-2xl mx-auto leading-relaxed">
            Join {stats.userCount > 1 ? `${stats.userCount} ` : ""}conlangers building structured, living languages. Free forever — no credit card, no catch.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={isAuthenticated ? "/dashboard" : "/login"} className="w-full sm:w-auto">
              <MagneticButton className="h-14 px-8 text-base font-medium rounded-full bg-background text-foreground hover:bg-background/90 w-full hover:scale-105 transition-all shadow-xl">
                {isAuthenticated ? "Go to Dashboard" : "Begin Your First Language"}
                <ArrowRight className="ml-2 w-5 h-5 pointer-events-none" />
              </MagneticButton>
            </Link>
            <Link href="/browse" className="w-full sm:w-auto">
              <MagneticButton
                variant="outline"
                className="h-14 px-8 text-base font-medium rounded-full border-2 border-background/20 text-background hover:bg-background/10 bg-transparent w-full transition-all"
              >
                <Globe className="mr-2 w-5 h-5 pointer-events-none" />
                Explore the Universe
              </MagneticButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Survey Notification */}
      <SurveyBanner />

      {/* Footer */}
      <Footer />
    </main >
  )
}
