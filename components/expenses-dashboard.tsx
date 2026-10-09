'use client'

import { startTransition, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MonthYearPicker, type MonthYear } from '@/components/month-year-picker'
import { ExpenseTable } from '@/components/expense-table'
import { BoardDialog } from '@/components/board-dialog'
import { Button } from '@/components/ui/button'
import { ImportInvoiceDialog } from '@/components/import-invoice-dialog'
import { FloatingActionMenu } from '@/components/floating-action-menu'
import { AddExpenseDialog } from '@/components/add-expense-dialog'
import { SalaryCard } from '@/components/salary-card'
import Footer from './Footer'
import { BarChart3, Menu, SlidersHorizontal } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import Link from 'next/link'
import { PwaInstallButton } from '@/components/pwa-install-button'

type Board = {
  id: string
  name: string
  month: number
  year: number
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isCurrentMonth(selected: MonthYear): boolean {
  const now = new Date()
  return selected.month === now.getMonth() && selected.year === now.getFullYear()
}



export function ExpensesDashboard({ navigationActions, notificationActions }: { navigationActions?: ReactNode; notificationActions?: ReactNode } = {}) {
  const supabase = createClient()
  const [boards, setBoards] = useState<Board[]>([])
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [boardsError, setBoardsError] = useState(false)
  const [mainPanelRefreshKey, setMainPanelRefreshKey] = useState(0)
  const [fabNewExpenseOpen, setFabNewExpenseOpen] = useState(false)
  const [fabNewBoardOpen, setFabNewBoardOpen] = useState(false)
  const [fabImportOpen, setFabImportOpen] = useState(false)
  const [navigationOpen, setNavigationOpen] = useState(false)


  const [selected, setSelected] = useState<MonthYear>(() => {
    const now = new Date()
    return { month: now.getMonth(), year: now.getFullYear() }
  })

  const [mainPanelTotal, setMainPanelTotal] = useState(0)

  const fetchMainPanelTotal = useCallback(async () => {
    const from = new Date(Date.UTC(selected.year, selected.month, 1)).toISOString().slice(0, 10)
    const to = new Date(Date.UTC(selected.year, selected.month + 1, 1)).toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('expenses')
      .select('valor')
      .is('board_id', null)
      .gte('data_pagamento', from)
      .lt('data_pagamento', to)

    if (!error && data) {
      setMainPanelTotal(data.reduce((sum, e) => sum + e.valor, 0))
    }
  }, [supabase, selected.month, selected.year])

  useEffect(() => {
    fetchMainPanelTotal()
  }, [fetchMainPanelTotal, mainPanelRefreshKey])

  const fetchBoards = useCallback(
    async function loadBoards(attempt = 0) {
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
          return loadBoards(attempt + 1)
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
    startTransition(() => { void fetchBoards() })
  }, [fetchBoards])

 async function handleDeleteBoard(boardId: string) {
  const confirmed = window.confirm(
    'Excluir este quadro? Todas as despesas serão apagadas (parcelas futuras também), exceto despesas recorrentes, que serão movidas para o painel principal.'
  )
  if (!confirmed) return

  const { error } = await supabase.rpc('delete_board_cascade', { board_id_input: boardId })

  if (error) {
    console.error('Erro ao excluir quadro:', error)
    return
  }

  fetchBoards()
  setMainPanelRefreshKey((k) => k + 1)
}

  // Called whenever any board's expenses change OR the board itself is renamed.
  // Forces the main panel to refetch (mirror expense updates) AND the boards
  // list to refetch (board.name prop flows into the table's <h2>).
  const bumpMainPanel = useCallback(() => {
    setMainPanelRefreshKey((k) => k + 1)
    fetchBoards()
  }, [fetchBoards])

  function handleGoToCurrentMonth() {
    const now = new Date()
    setSelected({ month: now.getMonth(), year: now.getFullYear() })
  }

  const boardsForMonth = boards.filter(
    (b) => b.month === selected.month && b.year === selected.year
  )

  return (
    <div className="space-y-6">
      <nav aria-label="Navegação do Dashboard" className="flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-border bg-card px-3 py-2 sm:px-4">
        <Link href={`/planning?month=${selected.year}-${String(selected.month + 1).padStart(2, '0')}`} className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-xl px-2 text-sm font-medium hover:bg-accent">
          <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
          <span className="sm:hidden">Planejamento</span><span className="hidden sm:inline">Orçamento e lembretes</span>
        </Link>
        <div className="ml-auto">{notificationActions}</div>
        <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
          <DialogTrigger render={<Button variant="ghost" size="sm" aria-label="Abrir menu de navegação" aria-expanded={navigationOpen} className="shrink-0 gap-2"><Menu className="size-5" aria-hidden="true" />Menu</Button>} />
          <DialogContent className="dashboard-navigation-drawer top-0 right-0 left-auto h-dvh w-[min(22rem,90vw)] max-w-none translate-x-0 translate-y-0 content-start gap-6 overflow-y-auto rounded-l-3xl rounded-r-none p-6 sm:max-w-none">
            <DialogHeader className="pr-6">
              <DialogTitle>Menu</DialogTitle>
              <DialogDescription>Aparência, suporte e sua conta.</DialogDescription>
            </DialogHeader>
            <nav aria-label="Opções da conta" className="flex flex-col items-stretch gap-3 [&>a]:flex [&>a]:min-h-11 [&>a]:items-center [&>a]:rounded-xl [&>button]:min-h-11 [&>button]:justify-start [&>form>button]:w-full [&>form>button]:justify-start" onClick={event => {
              if ((event.target as HTMLElement).closest('a[href]')) setNavigationOpen(false)
            }}>
              {navigationActions}
              <PwaInstallButton />
            </nav>
          </DialogContent>
        </Dialog>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <MonthYearPicker value={selected} onChange={setSelected} />
          {!isCurrentMonth(selected) && (
            <Button variant="outline" size="sm" onClick={handleGoToCurrentMonth}>
              Mês atual
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
          <Link href="/reports" className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
            <BarChart3 className="mr-1 h-4 w-4" />
            Relatórios
          </Link>
        <ImportInvoiceDialog
          selected={selected}
          boards={boardsForMonth}
          onImported={(paymentPeriod) => {
            setSelected(paymentPeriod)
            fetchBoards()
            setMainPanelRefreshKey((k) => k + 1)
          }}
        />
        </div>
      </div>

      <SalaryCard selected={selected} totalExpenses={mainPanelTotal} />

      <ExpenseTable
        boardId={null}
        title="Painel principal"
        selected={selected}
        refreshKey={mainPanelRefreshKey}
        onChanged={bumpMainPanel}
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
            refreshKey={mainPanelRefreshKey}
            onDeleteBoard={() => handleDeleteBoard(board.id)}
            onChanged={bumpMainPanel}
          />
        ))}
      <FloatingActionMenu
        onNewExpense={() => setFabNewExpenseOpen(true)}
        onNewBoard={() => setFabNewBoardOpen(true)}
        onImportInvoice={() => setFabImportOpen(true)}
      />

      {fabNewExpenseOpen && (
        <AddExpenseDialog
          selected={selected}
          boardId={null}
          boards={boards}
          chooseDestination
          forceOpen
          onAdded={(period) => {
            if (period) setSelected(period)
            fetchBoards()
            setFabNewExpenseOpen(false)
            setMainPanelRefreshKey((k) => k + 1)
          }}
          onOpenChange={(open) => !open && setFabNewExpenseOpen(false)}
        />
      )}

      <BoardDialog
        selected={selected}
        open={fabNewBoardOpen}
        onOpenChange={setFabNewBoardOpen}
        hideTrigger
        onCreated={() => {
          fetchBoards()
          setMainPanelRefreshKey((k) => k + 1)
          setFabNewBoardOpen(false)
        }}
      />

      <ImportInvoiceDialog
        selected={selected}
        boards={boardsForMonth}
        open={fabImportOpen}
        onOpenChange={setFabImportOpen}
        hideTrigger
        onImported={(paymentPeriod) => {
          setSelected(paymentPeriod)
          fetchBoards()
          setMainPanelRefreshKey((k) => k + 1)
          setFabImportOpen(false)
        }}
      />
      <Footer /></div>
  )
}
