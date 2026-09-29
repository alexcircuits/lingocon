import { serializeJsonLd } from "@/lib/utils/json-ld"

/** Structured-data script tag; always use this instead of hand-rolled `dangerouslySetInnerHTML`. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
