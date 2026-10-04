import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpensesDashboard } from '@/components/expenses-dashboard'
import { signOut } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { ReportDialog } from '@/components/report-dialog'
import { ChangePasswordButton } from '@/components/change-password-button'

export default async function HomePage() {
  const supabase = await createClient()

  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch (err) {
    // Invalid/expired refresh token — clear cookies and force re-login.
    console.warn('[home] getUser failed, redirecting to /login:', err)
    redirect('/login')
  }

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="material-dashboard container mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 material-app-bar">
        <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Painel de Despesas</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <p className="text-sm text-muted-foreground truncate max-w-[160px] sm:max-w-none">
            Bem-vindo, {user.user_metadata?.full_name || user.email}
          </p>

          <ChangePasswordButton />
          <ReportDialog />
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
