'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AddExpenseDialog } from '@/components/add-expense-dialog'

type Expense = {
  id: number
  nome: string
  data_pagamento: string
  valor: number
  status: 'Pendente' | 'Pago' | 'VR/VA'
  comentario: string | null
}

const statusColor: Record<Expense['status'], string> = {
  Pendente: 'bg-yellow-500',
  Pago: 'bg-green-500',
  'VR/VA': 'bg-blue-500',
}

export function ExpenseTable() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('data_pagamento', { ascending: true })

    if (!error && data) setExpenses(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const total = expenses.reduce((sum, e) => sum + e.valor, 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {/* This is the button/trigger for adding a new expense */}
        <AddExpenseDialog onAdded={fetchExpenses}>
          <Button variant="outline" size="sm">Novo lançamento</Button>
        </AddExpenseDialog>
      </div>

      <div className="rounded-xl border">
        {loading ? (
          <p className="text-sm text-muted-foreground p-4">Carregando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comentário</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{expense.nome}</TableCell>
                  <TableCell>
                    {new Date(expense.data_pagamento).toLocaleDateString('pt-BR', {
                      timeZone: 'UTC',
                    })}
                  </TableCell>
                  <TableCell>
                    {expense.valor.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor[expense.status]}>{expense.status}</Badge>
                  </TableCell>
                  <TableCell>{expense.comentario}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setEditingExpense(expense)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell>
                  {total.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>

      {/* This dialog instance is for editing */}
      {editingExpense && (
        <AddExpenseDialog
          expenseToEdit={editingExpense}
          onAdded={fetchExpenses}
          onOpenChange={(open) => !open && setEditingExpense(null)}
        />
      )}
    </div>
  )
}