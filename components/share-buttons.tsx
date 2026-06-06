"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  Twitter,
  Link2,
  Check,
  Facebook,
  MessageCircle,
} from "lucide-react"
import { toast } from "sonner"

interface ShareButtonsProps {
  url: string
  title: string
  description?: string
  className?: string
}

export function ShareButtons({
  url,
  title,
  description,
  className = "",
}: ShareButtonsProps) {
  const t = useTranslations("share")
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t("linkCopied"))
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error(t("copyFailed"))
    }
  }

  const handleTwitterShare = () => {
    const text = description
      ? `${title} - ${description}`
      : title
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(url)}`
    window.open(twitterUrl, "_blank", "width=550,height=420")
  }

  const handleRedditShare = () => {
    const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(
      url
    )}&title=${encodeURIComponent(title)}`
    window.open(redditUrl, "_blank", "width=550,height=420")
  }

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      url
    )}`
    window.open(facebookUrl, "_blank", "width=550,height=420")
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleTwitterShare}
        className="gap-2"
      >
        <Twitter className="h-4 w-4" />
        <span className="hidden sm:inline">Twitter</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRedditShare}
        className="gap-2"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Reddit</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleFacebookShare}
        className="gap-2"
      >
        <Facebook className="h-4 w-4" />
        <span className="hidden sm:inline">Facebook</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyLink}
        className="gap-2"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">{t("copied")}</span>
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t("copyLink")}</span>
          </>
        )}
      </Button>
    </div>
  )
}

