/**
 * Small shared utilities used across the client and server.
 *
 * `cn` merges Tailwind class names; `formatDate` uses a fixed `date-fns` pattern so server and client
 * agree for the same input timestamp. If you need locale-aware formatting, pass an explicit
 * pattern and ensure the server uses the same locale/timezone assumptions.
 */
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

/** Combines `clsx` conditional classes with `tailwind-merge` deduplication. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date consistently between server and client to avoid hydration errors
export function formatDate(date: Date | string | number, formatStr: string = "M/d/yyyy"): string {
  const dateObj = date instanceof Date ? date : new Date(date)
  return format(dateObj, formatStr)
}

