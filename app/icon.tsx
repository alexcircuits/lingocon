import { ImageResponse } from 'next/og'

import { LOGO_C_PATH, LOGO_COLORS, LOGO_L_PATH } from '@/lib/brand/logo'

// Route segment config
export const runtime = 'edge'

// Image metadata
export const size = {
    width: 32,
    height: 32,
}
export const contentType = 'image/png'

// The mark fills 8–56 of its 64-unit grid; crop the empty margin so it stays
// as large as possible in a 32px tab icon.
const TIGHT_VIEW_BOX = '6 6 52 52'

// Image generation
export default function Icon() {
    return new ImageResponse(
        (
            <svg width={size.width} height={size.height} viewBox={TIGHT_VIEW_BOX} xmlns="http://www.w3.org/2000/svg">
                <path d={LOGO_L_PATH} fill={LOGO_COLORS.violet} />
                <path d={LOGO_C_PATH} fill={LOGO_COLORS.magenta} />
            </svg>
        ),
        // ImageResponse options
        {
            ...size,
        }
    )
}
