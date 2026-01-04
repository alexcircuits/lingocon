"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ArrowRight, Languages, BookOpen, FileText, Newspaper, BookMarked } from "lucide-react"

const iconMap = {
  Languages,
  BookOpen,
  FileText,
  Newspaper,
  BookMarked,
} as const

type IconName = keyof typeof iconMap

interface AnimatedStatCardProps {
  title: string
  count: number
  href: string
  iconName: IconName
  color: string
  bgColor: string
  index: number
}

export function AnimatedStatCard({
  title,
  count,
  href,
  iconName,
  color,
  bgColor,
  index,
}: AnimatedStatCardProps) {
  const Icon = iconMap[iconName]
  return (
    <Link href={href}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        whileHover={{ y: -4, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Card className="h-full border-border/40 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bgColor}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-semibold mb-0.5">{count}</div>
            <p className="text-xs text-muted-foreground">{title}</p>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  )
}

