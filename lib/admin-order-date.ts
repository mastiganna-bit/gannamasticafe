export type HistoryDateFilter = 'all' | 'today' | 'yesterday' | 'last7' | 'month' | 'custom'

const INDIA_TIME_ZONE = 'Asia/Kolkata'

export function indiaDateKey(value: string | number | Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function shiftDateKey(key: string, days: number) {
  const date = new Date(`${key}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function matchesHistoryDate(
  orderDateKey: string,
  filter: HistoryDateFilter,
  todayKey: string,
  options: { month: string; from: string; to: string },
) {
  if (filter === 'all') return true
  if (filter === 'today') return orderDateKey === todayKey
  if (filter === 'yesterday') return orderDateKey === shiftDateKey(todayKey, -1)
  if (filter === 'last7') return orderDateKey >= shiftDateKey(todayKey, -6) && orderDateKey <= todayKey
  if (filter === 'month') return Boolean(options.month) && orderDateKey.startsWith(`${options.month}-`)
  return (!options.from || orderDateKey >= options.from) && (!options.to || orderDateKey <= options.to)
}

export function indiaDayLabel(key: string, todayKey: string) {
  if (key === todayKey) return 'Today'
  if (key === shiftDateKey(todayKey, -1)) return 'Yesterday'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: INDIA_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${key}T12:00:00Z`))
}
