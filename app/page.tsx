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
  Library
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
export const dynamic = "force-dynamic"

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

export default async function Home() {
  const session = await auth()
  const isDevMode = process.env.DEV_MODE === "true"
  const [featuredLanguages, topLanguages] = await Promise.all([
    getFeaturedLanguages(),
    getTopLanguages(),
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
      <Navbar user={user} isDevMode={isDevMode} />

      {/* Hero Section - Clean & Modern */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4 overflow-hidden min-h-[90vh] flex flex-col justify-center">
        <HeroBackground />

        <div className="container mx-auto max-w-5xl relative z-10 text-center">
          <Badge
            variant="outline"
            className="mb-8 px-4 py-1.5 text-sm font-medium border-primary/20 bg-primary/5 text-primary rounded-full backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700 font-mono tracking-wide"
          >
            v1.0 Public Beta
          </Badge>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif font-medium tracking-tight mb-8 leading-[1.1] text-foreground">
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

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-24 items-center">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <MagneticButton size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all bg-primary text-primary-foreground">
                  Open Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </MagneticButton>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <MagneticButton size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all bg-primary text-primary-foreground">
                    Start Building
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </MagneticButton>
                </Link>
                <Link href="/browse">
                  <MagneticButton size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full bg-background/50 backdrop-blur-sm border-primary/20 hover:bg-secondary/50">
                    Explore Corpus
                  </MagneticButton>
                </Link>
              </>
            )}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 border-t border-border/40 pt-12">
            <p className="text-xs font-semibold text-muted-foreground/60 mb-6 uppercase tracking-[0.2em]">
              Trending in the Corpus
            </p>
            <TopLanguagesStripe languages={topLanguages} />
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

      {/* Featured Languages */}
      {featuredLanguages.length > 0 && (
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
      )}

      {/* Footer */}
      <Footer />
    </main>
  )
}
