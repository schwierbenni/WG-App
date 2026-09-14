import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined, pattern = 'dd.MM.yyyy'): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return format(d, pattern)
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'PENDING': return 'bg-yellow-100 text-yellow-800'
    case 'ACCEPTED': return 'bg-green-100 text-green-800'
    case 'REJECTED': return 'bg-red-100 text-red-800'
    case 'COMPLETED': return 'bg-blue-100 text-blue-800'
    case 'OVERDUE': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export function getIntervalLabel(interval: string): string {
  switch (interval) {
    case 'DAILY': return 'Täglich'
    case 'WEEKLY': return 'Wöchentlich'
    case 'BIWEEKLY': return 'Alle 2 Wochen'
    case 'MONTHLY': return 'Monatlich'
    case 'MANUAL': return 'Manuell'
    default: return interval
  }
}

const WEEKDAY_LABELS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

export function getWeekdayLabel(weekday: number | null | undefined): string | null {
  if (weekday === null || weekday === undefined) return null
  return WEEKDAY_LABELS[weekday] ?? null
}

const WEEKDAY_ADVERBS = ['sonntags', 'montags', 'dienstags', 'mittwochs', 'donnerstags', 'freitags', 'samstags']

// Duties with a fixed Stichtag-Wochentag show that weekday instead of a
// concrete calendar date — the exact date is just an internal computation,
// not something members should have to think about.
export function getDueLabel(dueDate: Date | string | null | undefined, weekday?: number | null): string {
  if (weekday !== null && weekday !== undefined && WEEKDAY_ADVERBS[weekday]) {
    return WEEKDAY_ADVERBS[weekday]
  }
  return formatDate(dueDate)
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount)
}

export function getInitials(name: string): string {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}
