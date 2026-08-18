'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MonthYearPicker, type MonthYear } from '@/components/month-year-picker'
import { ExpenseTable } from '@/components/expense-table'
import { BoardDialog } from '@/components/board-dialog'

type Board = {
  id: string
  name: string
  month: number
  year: number
}

export function ExpensesDashboard() {
  const supabase = createClient()
  const [boards, setBoards] = useState<Board[]>([])
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [mainPanelRefreshKey, setMainPanelRefreshKey] = useState(0)

  const [selected, setSelected] = useState<MonthYear>(() => {
    const now = new Date()
    return { month: now.getMonth(), year: now.getFullYear() }
  })

  const fetchBoards = useCallback(async () => {
    setLoadingBoards(true)
    const { data, error } = await supabase
      .from('boards')
      .select('id, name, month, year')
      .order('created_at', { ascending: true })

    if (!error && data) setBoards(data)
    setLoadingBoards(false)
  }, [supabase])

  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  async function handleDeleteBoard(boardId: string) {
    const confirmed = window.confirm(
      'Excluir este quadro? Todas as despesas dele e a despesa espelho no painel principal também serão apagadas.'
    )
    if (!confirmed) return

    const { error } = await supabase.from('boards').delete().eq('id', boardId)
    if (!error) {
      fetchBoards()
      setMainPanelRefreshKey((k) => k + 1)
    }
  }

  // Called whenever any board's expenses change. Forces the main panel
  // to refetch so the mirror expense's updated value shows up immediately.
  const bumpMainPanel = useCallback(() => {
    setMainPanelRefreshKey((k) => k + 1)
  }, [])

  const boardsForMonth = boards.filter(
    (b) => b.month === selected.month && b.year === selected.year
  )

  return (
    <div className="space-y-10">
      <div className="flex justify-end items-center gap-2">
        <MonthYearPicker value={selected} onChange={setSelected} />
        <BoardDialog
          selected={selected}
          onCreated={() => {
            fetchBoards()
            setMainPanelRefreshKey((k) => k + 1)
          }}
        />
      </div>

      <ExpenseTable
        boardId={null}
        title="Painel principal"
        selected={selected}
        refreshKey={mainPanelRefreshKey}
      />

      {!loadingBoards &&
        boardsForMonth.map((board) => (
          <ExpenseTable
            key={board.id}
            boardId={board.id}
            title={board.name}
            selected={selected}
            onDeleteBoard={() => handleDeleteBoard(board.id)}
            onChanged={bumpMainPanel}
          />
        ))}
    </div>
  )
}