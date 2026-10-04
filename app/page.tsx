import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExpensesDashboard } from '@/components/expenses-dashboard'
import { signOut } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { ReportDialog } from '@/components/report-dialog'
import { ChangePasswordButton } from '@/components/change-password-button'
import Link from 'next/link'
import { isMasterIdentity } from '@/lib/tickets'
import { avatarPath, AVATAR_BUCKET, googlePhoto } from '@/lib/profile-photo'
import { ProfilePhoto } from '@/components/profile-photo'
import { ThemeSelector } from '@/components/theme-selector'

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
  const customPhoto = avatarPath(user)
  const providerPhoto = googlePhoto(user)
  let profilePhoto = providerPhoto
  if (customPhoto) {
    try {
      const result = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(customPhoto, 3600)
      if (!result.error) profilePhoto = result.data?.signedUrl ?? providerPhoto
    } catch { /* Keep the dashboard available when image storage is unavailable. */ }
  }
  const displayName = String(user.user_metadata?.full_name || user.email || 'Usuário')

  return (
    <div className="material-dashboard container mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <header className="material-app-bar mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Painel de Despesas</h1>
        <div className="ml-auto flex min-w-0 max-w-full items-center gap-3">
          <ProfilePhoto name={displayName} photo={profilePhoto} custom={!!customPhoto} hasGooglePhoto={!!providerPhoto} />
          <p className="text-sm text-muted-foreground truncate max-w-[160px] sm:max-w-none">Bem-vindo, {displayName}</p>
        </div>
      </header>
      <main>
        <ExpensesDashboard navigationActions={<>
          <ThemeSelector />
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
        </>} />
      </main>
    </div>
  )
}
