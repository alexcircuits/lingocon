/**
 * The LingoCon mark: an L and a C as two building blocks that lock into a
 * square. Kept as plain path data so the React component, the favicon and the
 * share images all draw the exact same shape.
 *
 * Geometry (64-unit grid): the mark fills 8–56 on both axes, the L is 14 thick,
 * the C sits 3.5 away from it and is 10.5–11 thick, outer corners are r=3.5.
 */
export const LOGO_VIEW_BOX = "0 0 64 64"

export const LOGO_L_PATH =
  "M11.5 8h7a3.5 3.5 0 0 1 3.5 3.5V42h30.5a3.5 3.5 0 0 1 3.5 3.5v7a3.5 3.5 0 0 1-3.5 3.5h-41A3.5 3.5 0 0 1 8 52.5v-41A3.5 3.5 0 0 1 11.5 8z"

export const LOGO_C_PATH =
  "M29 8h23.5a3.5 3.5 0 0 1 3.5 3.5V15a3.5 3.5 0 0 1-3.5 3.5h-16V28h16a3.5 3.5 0 0 1 3.5 3.5V35a3.5 3.5 0 0 1-3.5 3.5H29a3.5 3.5 0 0 1-3.5-3.5V11.5A3.5 3.5 0 0 1 29 8z"

/**
 * Fixed brand colours for places that cannot read the theme's CSS variables
 * (generated PNGs, share images). In the app itself the mark follows
 * `--primary` and `--accent` instead.
 */
export const LOGO_COLORS = {
  violet: "#7352F4",
  magenta: "#FF4D9D",
  /** The C on a violet tile, where full magenta would vibrate. */
  pinkOnViolet: "#FF9CC9",
  white: "#FFFFFF",
} as const
