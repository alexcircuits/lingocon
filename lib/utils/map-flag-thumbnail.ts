// Canvas flags must use optimized thumbnails; CSS/drawImage sizing does not
// bound the decoded size of a multi-megapixel original.
import { getImageProps } from "next/image"

export function mapFlagThumbnail(src: string): string | null {
  const { props } = getImageProps({
    src,
    alt: "",
    width: 64,
    height: 64,
    quality: 75,
  })
  // Next bypasses optimization for SVG/data URLs. Use the colored node instead
  // of silently falling back to an unbounded source; originals remain intact.
  return props.src.startsWith("/_next/image?") ? props.src : null
}
