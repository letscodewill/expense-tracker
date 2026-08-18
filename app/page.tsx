import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpensesDashboard } from '@/components/expenses-dashboard'
import { signOut } from '@/app/actions'
import { Button } from '@/components/ui/button'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Painel de Despesas</h1>
        <div className="flex items-center gap-4">
          <p className="text-muted-foreground">Bem-vindo, {user.email}</p>
          <form>
            <Button formAction={signOut} type="submit" variant="outline" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main>
        <ExpensesDashboard />
      </main>
    </div>
  )
}