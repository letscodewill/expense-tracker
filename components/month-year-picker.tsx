'use client'

import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from 'lucide-react'

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export type MonthYear = {
  /** 0-based month index (0 = January, 11 = December). */
  month: number
  /** 4-digit year. */
  year: number
}

type MonthYearItem = {
  /** Stable id used as the Select value. */
  value: string
  /** Human-readable label, e.g. "Janeiro 2026". */
  label: string
  /** 0-based month index (0 = January, 11 = December). */
  month: number
  /** 4-digit year. */
  year: number
}

function makeId(month: number, year: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/**
 * Builds items from January of the current year up to (and including)
 * the current month. As months pass, the list grows automatically since
 * it's always derived from `now` at render time.
 */
function buildItems(now: Date): MonthYearItem[] {
  const items: MonthYearItem[] = []
  const startYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const monthsAhead = 6

  // Total months from January of startYear up to `monthsAhead` months
  // past the current month.
  const totalMonths = currentMonth + monthsAhead + 1

  for (let i = 0; i < totalMonths; i++) {
    const year = startYear + Math.floor(i / 12)
    const month = i % 12
    items.push({
      month,
      year,
      value: makeId(month, year),
      label: `${MONTH_NAMES_PT[month]} ${year}`,
    })
  }
  return items
}

export type MonthYearPickerProps = {
  value: MonthYear
  onChange: (next: MonthYear) => void
}

export function MonthYearPicker({ value, onChange }: MonthYearPickerProps) {
  const items = useMemo(() => buildItems(new Date()), [])

  const currentValue = makeId(value.month, value.year)
  const currentLabel =
    items.find((i) => i.value === currentValue)?.label ??
    `${MONTH_NAMES_PT[value.month]} ${value.year}`

  return (
    <Select
      items={items}
      value={currentValue}
      onValueChange={(next: string | null) => {
        if (next == null) return
        const picked = items.find((i) => i.value === next)
        if (!picked) return
        onChange({ month: picked.month, year: picked.year })
      }}
    >
      <SelectTrigger className="min-w-[12rem]">
        <SelectValue placeholder={currentLabel}>
          <span className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            {currentLabel}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { MONTH_NAMES_PT }