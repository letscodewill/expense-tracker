import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpensesDashboard } from '@/components/expenses-dashboard'
import { signOut } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { ReportDialog } from '@/components/report-dialog'
import { ChangePasswordButton } from '@/components/change-password-button'
import Link from 'next/link'
import { isMasterIdentity } from '@/lib/tickets'

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
  const ticketAccess = user.email_confirmed_at ? await supabase.rpc('is_ticket_master') : null
  const ticketAdmin = !ticketAccess?.error && ticketAccess?.data === true

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
          <Link href="/tickets" className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-accent">Meus tickets</Link>
          {ticketAdmin && <Link href="/admin/tickets" className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent">Painel de tickets</Link>}
          {isMasterIdentity(user) && <Link href="/admin/administrators" className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-accent">Administradores</Link>}
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
