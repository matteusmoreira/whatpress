import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formata tooltip de uso/limite com números no locale
export function formatUsageTooltip(current?: number, max?: number, locale: string = 'pt-BR') {
  const nf = new Intl.NumberFormat(locale)
  return `Limite atingido (${nf.format(current ?? 0)}/${nf.format(max ?? 0)})`
}

// Formata tempo relativo para próximos envios (ex.: "em 2h 30m")
export function formatRelativeTime(target?: Date | string | number, now: Date = new Date()): string {
  if (!target) return 'em breve'
  const targetDate = target instanceof Date ? target : new Date(target)
  const diffMs = targetDate.getTime() - now.getTime()
  if (diffMs <= 0) return 'em breve'
  const totalMinutes = Math.round(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  return `em ${parts.join(' ') || 'breve'}`
}

// Formata tempo absoluto (fallback), ex.: "20/10/2025 14:30"
export function formatAbsoluteTime(date?: Date, locale: string = 'pt-BR') {
  if (!date) return 'em breve'
  return date.toLocaleString(locale)
}
