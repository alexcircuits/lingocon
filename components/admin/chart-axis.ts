/**
 * Width of a chart's value axis. The charts pull the plot 16 px left to save space, which left
 * room for two-digit ticks only: traffic counts in the hundreds were cut to their last digits.
 * Ticks are 11 px numerals (about 7 px each); the top tick can round up past the largest value.
 */
export function yAxisWidth(data: Array<Record<string, string | number>>, keys: string[]): number {
  const max = Math.max(0, ...data.flatMap((row) => keys.map((key) => Number(row[key]) || 0)))
  const digits = String(Math.ceil(max * 1.25)).length
  return 24 + digits * 7
}
