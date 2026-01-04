import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date consistently between server and client to avoid hydration errors
export function formatDate(date: Date | string | number, formatStr: string = "M/d/yyyy"): string {
  const dateObj = date instanceof Date ? date : new Date(date)
  return format(dateObj, formatStr)
}

