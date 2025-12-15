import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format date consistently for server and client rendering
 * Prevents hydration mismatches from locale-specific formatting
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A"
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    if (isNaN(date.getTime())) return "N/A"
    return format(date, 'MMM dd, yyyy')
  } catch {
    return "N/A"
  }
}

/**
 * Format time consistently for server and client rendering
 * Prevents hydration mismatches from locale-specific formatting
 */
export function formatTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A"
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    if (isNaN(date.getTime())) return "N/A"
    return format(date, 'HH:mm')
  } catch {
    return "N/A"
  }
}

/**
 * Format date and time consistently for server and client rendering
 */
export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A"
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    if (isNaN(date.getTime())) return "N/A"
    return format(date, 'MMM dd, yyyy HH:mm')
  } catch {
    return "N/A"
  }
}
