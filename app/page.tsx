import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid"
import {
  BookOpen,
  Languages,
  FileText,
  ArrowRight,
  Sparkles,
  Search,
  PenTool,
  Library,
  Github,
  Construction,
  Heart
} from "lucide-react"
import { FeaturedLanguages } from "@/components/featured-languages"
import { Navbar } from "@/components/navbar"
import { TopLanguagesStripe } from "@/components/top-languages-stripe"
import { ContainerScroll } from "@/components/ui/container-scroll-animation"
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards"
import { SparklesCore } from "@/components/ui/sparkles"
import { HeroBackground } from "@/components/hero-background"
import { TextReveal } from "@/components/ui/text-reveal"
import { MagneticButton } from "@/components/ui/magnetic-button"
import { Footer } from "@/components/footer"
import { WordOfTheDay } from "@/components/word-of-the-day"
import { SurveyBanner } from "@/components/survey-banner"
import { LingoConUniverseMap } from "@/components/landing/universe-map"

export const dynamic = "force-dynamic"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lingocon.com"

function JsonLd() {
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
    logo: `${siteUrl}/logo.png`,
    sameAs: [],
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
    </>
  )
}


async function getFeaturedLanguages() {
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
      { dictionaryEntries: { _count: "desc" } },
      { updatedAt: "desc" },
    ],
    take: 6,
  })

  return languages
}

async function getTopLanguages() {
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
}

import { DictionaryCard } from "@/components/landing/dictionary-card"
import { GrammarCard } from "@/components/landing/grammar-card"
import { ScriptCard } from "@/components/landing/script-card"
import { ParadigmCard } from "@/components/landing/paradigm-card"

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

async function getUniverseLanguages() {
  return prisma.language.findMany({
    where: { visibility: "PUBLIC" },
    select: {
      id: true,
      name: true,
      slug: true,
      flagUrl: true,
      parentLanguageId: true,
      owner: { select: { name: true } },
      _count: { select: { dictionaryEntries: true } }
    }
  })
}

export default async function Home() {
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"
  const [featuredLanguages, topLanguages, universeLanguages] = await Promise.all([
    getFeaturedLanguages(),
    getTopLanguages(),
    getUniverseLanguages(),
  ])
  const isAuthenticated = session || isDevMode

  const user = session?.user ? {
    id: session.user.id!,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  } : null

  const features = [
    {
      title: "Script & Alphabet",
      description: "Define custom scripts with IPA mapping and romanization support.",
      header: <ScriptCard />,
      icon: <PenTool className="h-4 w-4 text-primary" />,
      className: "md:col-span-2 effect-card",
    },
    {
      title: "Grammar Wiki",
      description: "Write rich articles with interlinear glossing.",
      header: <GrammarCard />,
      icon: <BookOpen className="h-4 w-4 text-violet-500" />,
      className: "md:col-span-1 effect-card",
    },
    {
      title: "Smart Dictionary",
      description: "Full lexicon with search, filtering, and POS tagging.",
      header: <DictionaryCard />,
      icon: <Search className="h-4 w-4 text-emerald-500" />,
      className: "md:col-span-1 effect-card",
    },
    {
      title: "Morphology Tables",
      description: "Create complex conjugation and declension paradigms.",
      header: <ParadigmCard />,
      icon: <Library className="h-4 w-4 text-rose-500" />,
      className: "md:col-span-2 effect-card",
    },
  ]

  const testimonials = [
    {
      quote: "LingoCon has completely transformed how I document my conlangs. The dictionary tools are a lifesaver.",
      name: "Alex C.",
      title: "Conlanger since 2015",
    },
    {
      quote: "Finally, a tool that understands glossing rules. My grammar documentation looks professional now.",
      name: "Sarah J.",
      title: "Linguistics Student",
    },
    {
      quote: "The script support is incredible. Being able to see my constructed script rendered live is magic.",
      name: "Marcus R.",
      title: "Fantasy Author",
    },
    {
      quote: "I used to use five different spreadsheets. LingoCon replaced them all.",
      name: "Emily T.",
      title: "Worldbuilder",
    },
    {
      quote: "The best platform for sharing conlangs with the community. I love the feedback features.",
      name: "David K.",
      title: "Language Enthusiast",
    },
  ]

  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20">
      <JsonLd />
      <Navbar user={user} isDevMode={isDevMode} />

      {/* Hero Section - Clean & Modern */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4 overflow-hidden min-h-[90vh] flex flex-col justify-center">
        <HeroBackground />

        <div className="container mx-auto max-w-5xl relative z-10 text-center">
          <Badge
            variant="outline"
            className="mb-8 px-4 py-1.5 text-sm font-medium border-primary/20 bg-primary/5 text-primary rounded-full backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700 font-mono tracking-wide"
          >
            v2.0
          </Badge>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif font-medium tracking-tight mb-8 leading-[0.9] text-foreground">
            <TextReveal text="Create living languages" />
            <br />
            <span className="italic relative inline-block">
              <span className="text-gradient relative z-10">with structure</span>
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-accent opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                <line x1="0" y1="5" x2="100" y2="5" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed font-light">
            LingoCon is the professional toolkit for language construction.
            Define grammar, build structured dictionaries, and visualize your syntax.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            {isAuthenticated ? (
              <Link href="/dashboard" className="w-full sm:w-auto">
                <MagneticButton className="h-14 px-8 text-base font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 w-full hover:scale-105 transition-all shadow-lg hover:shadow-primary/25">
                  Go to Dashboard <ArrowRight className="ml-2 w-5 h-5 pointer-events-none" />
                </MagneticButton>
              </Link>
            ) : (
              <Link href="/login" className="w-full sm:w-auto">
                <MagneticButton className="h-14 px-8 text-base font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 w-full hover:scale-105 transition-all shadow-lg hover:shadow-primary/25">
                  Start Building <ArrowRight className="ml-2 w-5 h-5 pointer-events-none" />
                </MagneticButton>
              </Link>
            )}
            <Link href="/browse" className="w-full sm:w-auto">
              <MagneticButton
                variant="outline"
                className="h-14 px-8 text-base font-medium rounded-full border-2 border-primary/20 hover:border-primary/50 bg-background/50 backdrop-blur-sm w-full transition-all"
              >
                Browse Languages
              </MagneticButton>
            </Link>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 border-t border-border/40 pt-12">
            <p className="text-xs font-semibold text-muted-foreground/60 mb-6 uppercase tracking-[0.2em]">
              Trending in the Corpus
            </p>
            <TopLanguagesStripe languages={topLanguages} />
          </div>
        </div>
      </section>

      {/* Contributor Callout */}
      <section className="py-12 border-y border-border/40 bg-zinc-50/50 dark:bg-zinc-900/50">
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
          <div className="flex items-center gap-4">
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

      {/* Philosophy Section - Typography Focused */}
      <section className="py-32 px-4 bg-foreground text-background overflow-hidden relative">
        <div className="container mx-auto max-w-4xl relative z-10">
          <div className="flex flex-col gap-12">
            <h2 className="text-4xl sm:text-6xl md:text-7xl font-serif font-medium leading-[1.1] tracking-tight">
              Spreadsheets define data. <br />
              <span className="text-muted-foreground/60 italic">LingoCon defines culture.</span>
            </h2>

            <div className="grid md:grid-cols-2 gap-12 pt-8 border-t border-background/20">
              <p className="text-lg md:text-xl leading-relaxed text-background/80 font-light">
                Language isn&apos;t just a list of words. It&apos;s a complex web of relationships,
                from the phonotactics that shape your sound to the syntax tree that holds your thought.
              </p>
              <p className="text-lg md:text-xl leading-relaxed text-background/80 font-light">
                We built LingoCon to be the IDE for conlangs. Structural integrity,
                cross-referencing, and export-ready formatting come standard. This is where your world begins to speak.
              </p>
            </div>
          </div>
        </div>

        {/* Subtle background detail */}
        <div className="absolute top-0 right-0 p-8 opacity-10 font-mono text-9xl font-bold tracking-tighter select-none pointer-events-none">
          IDE
        </div>
      </section>

      {/* Studio Preview - Scroll Animation */}
      <section className="bg-background relative -mt-20 z-10">
        <ContainerScroll
          titleComponent={
            <div className="flex flex-col items-center gap-2 mb-10">
              <Badge variant="outline" className="text-xs uppercase tracking-widest border-primary/20 bg-primary/5 text-primary">
                The Workbench
              </Badge>
              <h1 className="text-4xl md:text-6xl font-serif font-medium text-foreground">
                Your Language Studio <br />
                <span className="text-4xl md:text-[6rem] font-bold mt-1 leading-none text-gradient block">
                  Reimagined
                </span>
              </h1>
            </div>
          }
        >
          {/* Mock Studio UI */}
          <Link
            href={isAuthenticated ? "/dashboard" : "/login"}
            className="w-full h-full bg-background rounded-2xl overflow-hidden flex flex-col items-start justify-start relative shadow-inner group/tablet cursor-pointer transition-all duration-500 hover:ring-1 hover:ring-primary/20"
          >
            {/* Header */}
            <div className="w-full h-12 border-b border-border/10 bg-muted/20 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
              <div className="w-3 h-3 rounded-full bg-green-400/80" />
              <div className="ml-4 h-6 w-96 bg-muted/40 rounded-md" />
            </div>
            {/* Body */}
            <div className="flex-1 w-full flex">
              <div className="w-64 border-r border-border/10 h-full p-4 space-y-4 bg-muted/10 hidden md:block">
                <div className="w-full h-8 bg-primary/10 rounded" />
                <div className="w-3/4 h-4 bg-muted/30 rounded" />
                <div className="w-1/2 h-4 bg-muted/30 rounded" />
                <div className="w-2/3 h-4 bg-muted/30 rounded" />
              </div>
              <div className="flex-1 p-8 grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="w-full h-32 bg-secondary/30 rounded-lg border border-border/20" />
                  <div className="w-full h-64 bg-secondary/30 rounded-lg border border-border/20" />
                </div>
                <div className="space-y-4 pt-12">
                  <div className="w-full h-24 bg-primary/5 rounded-lg border border-primary/10" />
                  <div className="w-full h-48 bg-secondary/30 rounded-lg border border-border/20" />
                </div>
              </div>
            </div>

            {/* Overlay Text */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] opacity-0 group-hover/tablet:opacity-100 transition-opacity duration-500">
              <div className="bg-background/90 text-foreground px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 transform translate-y-4 group-hover/tablet:translate-y-0 transition-transform duration-500 font-medium">
                {isAuthenticated ? "Open Studio Dashboard" : "Sign In to Start Building"}
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        </ContainerScroll>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-secondary/30 relative border-y border-border/40">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif mb-4">
              Everything you need to create
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From phonology to syntax, we provide structured tools that adapt to your language&apos;s unique features.
            </p>
          </div>

          <BentoGrid className="max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <BentoGridItem
                key={i}
                title={feature.title}
                description={feature.description}
                header={feature.header}
                icon={feature.icon}
                className={feature.className}
              />
            ))}
          </BentoGrid>
        </div>
      </section>

      {/* Community Voices */}
      {/* <section className="py-24 bg-background border-b border-border/40 overflow-hidden">
        <div className="container mx-auto px-4 mb-12 text-center">
          <h2 className="text-3xl md:text-5xl font-serif mb-6">Loved by Conlangers</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Join thousands of worldbuilders who trust LingoCon.
          </p>
        </div>
        <InfiniteMovingCards items={testimonials} direction="right" speed="slow" />
      </section> */}

      {/* Word of the Day */}
      <section className="py-24 bg-secondary/30 border-y border-border/40">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif mb-4">
              Word of the Day
            </h2>
            <p className="text-muted-foreground text-lg">
              Discover new words from our community&apos;s languages
            </p>
          </div>
          <div className="max-w-lg mx-auto">
            <WordOfTheDay />
          </div>
        </div>
      </section>

      {/* Featured Languages */}
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

      {/* Support Section */}
      <section className="py-24 bg-rose-500/5 border-t border-rose-500/10 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.03)_0,transparent_100%)] pointer-events-none" />
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 mb-6 shadow-sm ring-1 ring-rose-500/20">
            <Heart className="w-8 h-8 fill-rose-500/20" />
          </div>
          <h2 className="text-3xl md:text-5xl font-serif mb-6 tracking-tight text-foreground">
            Support Our Mission
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            LingoCon is built by language lovers, for language lovers. If our platform helps your worlds come alive, consider helping us keep the lights on and the servers running.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/donate">
              <Button size="lg" className="rounded-full h-14 px-8 bg-rose-500 hover:bg-rose-600 text-white gap-2 shadow-xl shadow-rose-500/20 transition-all hover:scale-105">
                <Heart className="w-5 h-5 fill-current" />
                Donate via OpenCollective
              </Button>
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
