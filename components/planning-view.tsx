'use client'
import { useState } from 'react'
import { MonthYearPicker, type MonthYear } from '@/components/month-year-picker'
import { BudgetReminders } from '@/components/budget-reminders'

export function PlanningView({ initialPeriod }: { initialPeriod: MonthYear }) {
  const [selected, setSelected] = useState(initialPeriod)
  return <div className="space-y-6">
    <div className="material-toolbar"><MonthYearPicker value={selected} onChange={setSelected} /></div>
    <BudgetReminders selected={selected} refreshKey={0} />
  </div>
}
