import type { SVGProps } from "react"

import { LOGO_C_PATH, LOGO_L_PATH, LOGO_VIEW_BOX } from "@/lib/brand/logo"
import { cn } from "@/lib/utils"

type LogoMarkProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Accessible name. Leave it out when the wordmark is right beside the mark. */
  title?: string
}

/**
 * The LingoCon mark. The L takes the current text colour (the theme's primary
 * by default) and the C takes the theme's accent, so it follows the palette.
 */
export function LogoMark({ title, className, ...props }: LogoMarkProps) {
  return (
    <svg
      viewBox={LOGO_VIEW_BOX}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("text-primary", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d={LOGO_L_PATH} fill="currentColor" />
      <path d={LOGO_C_PATH} className="fill-accent" />
    </svg>
  )
}
