'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MonthYearPicker, type MonthYear } from '@/components/month-year-picker'
import { ExpenseTable } from '@/components/expense-table'
import { BoardDialog } from '@/components/board-dialog'
import { Button } from '@/components/ui/button'

type Board = {
  id: string
  name: string
  month: number
  year: number
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function ExpensesDashboard() {
  const supabase = createClient()
  const [boards, setBoards] = useState<Board[]>([])
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [boardsError, setBoardsError] = useState(false)
  const [mainPanelRefreshKey, setMainPanelRefreshKey] = useState(0)

  const [selected, setSelected] = useState<MonthYear>(() => {
    const now = new Date()
    return { month: now.getMonth(), year: now.getFullYear() }
  })

  const fetchBoards = useCallback(
    async (attempt = 0) => {
      if (attempt === 0) {
        setLoadingBoards(true)
        setBoardsError(false)
      }

      const { data, error } = await supabase
        .from('boards')
        .select('id, name, month, year')
        .order('created_at', { ascending: true })

      if (error) {
        console.error(`Erro ao buscar quadros (tentativa ${attempt + 1}):`, error)

        const MAX_ATTEMPTS = 3
        if (attempt + 1 < MAX_ATTEMPTS) {
          await delay(1000 * (attempt + 1))
          return fetchBoards(attempt + 1)
        }

        setBoardsError(true)
        setLoadingBoards(false)
        return
      }

      if (data) setBoards(data)
      setBoardsError(false)
      setLoadingBoards(false)
    },
    [supabase]
  )

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

  // Called whenever any board's expenses change OR the board itself is renamed.
  // Forces the main panel to refetch (mirror expense updates) AND the boards
  // list to refetch (board.name prop flows into the table's <h2>).
  const bumpMainPanel = useCallback(() => {
    setMainPanelRefreshKey((k) => k + 1)
    fetchBoards()
  }, [fetchBoards])

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

      {boardsError && (
        <div className="text-center space-y-2">
          <p className="text-sm text-red-600">Não foi possível carregar os quadros.</p>
          <Button variant="outline" size="sm" onClick={() => fetchBoards()}>
            Tentar novamente
          </Button>
        </div>
      )}

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