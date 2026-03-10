"use client"

import { useState } from "react"
import { submitSurveyResponse } from "@/app/actions/survey"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { CheckCircle2, ArrowLeft, Send, ShieldCheck, Loader2 } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"

type Question = {
    id: string
    text: string
    type: "TEXT" | "SELECT" | "MULTI_SELECT"
    options: string[] | null
    required: boolean
    order: number
}

type SurveyData = {
    id: string
    title: string
    slug: string
    description: string | null
    questions: Question[]
}

export function SurveyForm({ survey }: { survey: SurveyData }) {
    const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleTextChange = (questionId: string, value: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }))
        setError(null)
    }

    const handleSelectChange = (questionId: string, value: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }))
        setError(null)
    }

    const handleMultiSelectToggle = (questionId: string, option: string) => {
        setAnswers(prev => {
            const current = (prev[questionId] as string[]) || []
            const updated = current.includes(option)
                ? current.filter(o => o !== option)
                : [...current, option]
            return { ...prev, [questionId]: updated }
        })
        setError(null)
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        setError(null)

        const result = await submitSurveyResponse({
            surveySlug: survey.slug,
            answers,
        })

        setIsSubmitting(false)

        if (result.error) {
            setError(result.error)
        } else {
            setIsSubmitted(true)
        }
    }

    if (isSubmitted) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center py-20"
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-8"
                >
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                </motion.div>
                <h2 className="text-3xl font-serif font-medium mb-3">Thank you!</h2>
                <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
                    Your anonymous response has been recorded. Thanks for helping us understand our community better.
                </p>
                <Link href="/survey">
                    <Button variant="outline" className="gap-2 rounded-full">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Surveys
                    </Button>
                </Link>
            </motion.div>
        )
    }

    return (
        <div>
            {/* Survey Header */}
            <div className="mb-10">
                <Link
                    href="/survey"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All Surveys
                </Link>
                <h1 className="text-3xl md:text-4xl font-serif font-medium tracking-tight mb-3">
                    {survey.title}
                </h1>
                {survey.description && (
                    <p className="text-muted-foreground text-lg leading-relaxed">
                        {survey.description}
                    </p>
                )}
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground/70">
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                    <span>This survey is completely anonymous — no data is linked to your account.</span>
                </div>
            </div>

            {/* Questions */}
            <div className="space-y-8">
                <AnimatePresence>
                    {survey.questions.map((question, index) => (
                        <motion.div
                            key={question.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.08, duration: 0.4 }}
                            className="rounded-xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-md"
                        >
                            <Label className="text-base font-medium mb-4 block">
                                <span className="text-muted-foreground/50 font-mono text-sm mr-2">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                {question.text}
                                {question.required && (
                                    <span className="text-red-400 ml-1">*</span>
                                )}
                            </Label>

                            {question.type === "TEXT" && (
                                <input
                                    type="text"
                                    value={(answers[question.id] as string) || ""}
                                    onChange={e => handleTextChange(question.id, e.target.value)}
                                    placeholder="Type your answer..."
                                    className="w-full h-11 px-4 rounded-lg border border-border/60 bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                                />
                            )}

                            {question.type === "SELECT" && question.options && (
                                <Select
                                    value={(answers[question.id] as string) || ""}
                                    onValueChange={val => handleSelectChange(question.id, val)}
                                >
                                    <SelectTrigger className="w-full h-11 rounded-lg">
                                        <SelectValue placeholder="Choose an option..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {question.options.map(option => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {question.type === "MULTI_SELECT" && question.options && (
                                <div className="grid grid-cols-2 gap-2">
                                    {question.options.map(option => {
                                        const selected = ((answers[question.id] as string[]) || []).includes(option)
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => handleMultiSelectToggle(question.id, option)}
                                                className={`
                                                    px-4 py-2.5 rounded-lg border text-sm font-medium text-left transition-all
                                                    ${selected
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-border/60 bg-background hover:border-primary/30 hover:bg-primary/5 text-muted-foreground"
                                                    }
                                                `}
                                            >
                                                {option}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Error */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm"
                >
                    {error}
                </motion.div>
            )}

            {/* Submit */}
            <div className="mt-10 flex justify-end">
                <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    size="lg"
                    className="gap-2 rounded-full px-8 h-12 text-base shadow-lg hover:shadow-xl transition-all"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <Send className="h-4 w-4" />
                            Submit Response
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
