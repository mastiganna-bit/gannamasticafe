import { describe, expect, it } from 'vitest'
import { indiaDateKey, matchesHistoryDate, shiftDateKey } from '@/lib/admin-order-date'

describe('admin order day filters', () => {
  it('changes the business day at midnight in India', () => {
    expect(indiaDateKey('2026-08-11T18:29:59.000Z')).toBe('2026-08-11')
    expect(indiaDateKey('2026-08-11T18:30:00.000Z')).toBe('2026-08-12')
  })

  it('handles yesterday and seven-day windows across month boundaries', () => {
    expect(shiftDateKey('2026-08-01', -1)).toBe('2026-07-31')
    expect(matchesHistoryDate('2026-07-31', 'yesterday', '2026-08-01', { month: '', from: '', to: '' })).toBe(true)
    expect(matchesHistoryDate('2026-07-26', 'last7', '2026-08-01', { month: '', from: '', to: '' })).toBe(true)
    expect(matchesHistoryDate('2026-07-25', 'last7', '2026-08-01', { month: '', from: '', to: '' })).toBe(false)
  })

  it('supports month and inclusive custom calendar filters', () => {
    expect(matchesHistoryDate('2026-08-15', 'month', '2026-09-01', { month: '2026-08', from: '', to: '' })).toBe(true)
    expect(matchesHistoryDate('2026-08-15', 'custom', '2026-09-01', { month: '', from: '2026-08-10', to: '2026-08-15' })).toBe(true)
    expect(matchesHistoryDate('2026-08-16', 'custom', '2026-09-01', { month: '', from: '2026-08-10', to: '2026-08-15' })).toBe(false)
  })
})
