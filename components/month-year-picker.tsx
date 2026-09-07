'use client'

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

export type MonthYearPickerProps = {
  value: MonthYear
  onChange: (next: MonthYear) => void
  /** Year range shown in the year selector. Defaults to now-2 .. now+5. */
  yearRange?: { from: number; to: number }
}

export function MonthYearPicker({ value, onChange, yearRange }: MonthYearPickerProps) {
  const now = new Date()
  const fromYear = yearRange?.from ?? now.getFullYear() - 2
  const toYear = yearRange?.to ?? now.getFullYear() + 5

  const years: number[] = []
  for (let y = fromYear; y <= toYear; y++) years.push(y)

  return (
  <div className="flex flex-wrap items-center gap-2">
    <Calendar className="size-4 text-muted-foreground shrink-0" />

    <Select
      value={String(value.month)}
      onValueChange={(next) => {
        if (next == null) return
        onChange({ month: parseInt(next), year: value.year })
      }}
    >
      <SelectTrigger className="w-[7.5rem] sm:w-[9rem]">
        <SelectValue>{MONTH_NAMES_PT[value.month]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {MONTH_NAMES_PT.map((name, index) => (
          <SelectItem key={index} value={String(index)}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    <Select
      value={String(value.year)}
      onValueChange={(next) => {
        if (next == null) return
        onChange({ month: value.month, year: parseInt(next) })
      }}
    >
      <SelectTrigger className="w-[5.5rem] sm:w-[6rem]">
        <SelectValue>{value.year}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {years.map((year) => (
          <SelectItem key={year} value={String(year)}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)
}

export { MONTH_NAMES_PT }