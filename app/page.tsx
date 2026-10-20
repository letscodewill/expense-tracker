import { getServerTranslation } from '@/lib/i18n/server'
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
import { AdminTicketNotifications } from '@/components/admin-ticket-notifications'
import { LanguageSelector } from '@/components/language-selector'
import { FeatureTour, FeatureTourLauncher } from '@/components/feature-tour'
import { FEATURE_TOUR_METADATA_KEY, FEATURE_TOUR_VERSION } from '@/lib/feature-tour'

export default async function HomePage() {
  const { t } = await getServerTranslation()

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
  let plan: { source?: string; can_manage_benefits?: boolean } | null = null
  try {
    const planResult = await supabase.rpc('get_my_plan')
    if (!planResult.error) plan = planResult.data
  } catch { /* A plan lookup outage must not hide the expense dashboard. */ }

  return (
    <div className="material-dashboard container mx-auto max-w-7xl px-3 py-4 sm:px-4 md:px-8 md:py-6">
      <header className="mb-4 flex min-w-0 items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-primary">NoControle</p>
          <h1 className="mt-1 text-xl font-medium tracking-tight sm:text-2xl">{t("Despesas")}</h1>
          {plan?.source === 'master' && <p className="mt-1 text-xs font-medium text-primary">{t('Master · Pro permanente')}</p>}
          {plan?.source === 'courtesy' && <p className="mt-1 text-xs font-medium text-primary">{t('Pro cortesia')}</p>}
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <ProfilePhoto name={displayName} photo={profilePhoto} custom={!!customPhoto} hasGooglePhoto={!!providerPhoto} />
          <p className="hidden max-w-[240px] truncate text-sm font-medium text-foreground sm:block">{displayName}</p>
        </div>
      </header>
      <main>
        <FeatureTour key={user.id} userId={user.id} signedInAt={user.last_sign_in_at ?? ''} dismissed={user.user_metadata?.[FEATURE_TOUR_METADATA_KEY] === FEATURE_TOUR_VERSION} />
        <ExpensesDashboard notificationActions={ticketAdmin ? <AdminTicketNotifications /> : undefined} navigationActions={<>
          <LanguageSelector />
          <ThemeSelector />
          <FeatureTourLauncher />
          <ChangePasswordButton />
          <ReportDialog />
          <Link href="/tickets" className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-accent">{t("Meus tickets")}</Link>
          {ticketAdmin && <Link href="/admin/tickets" className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent">{t("Painel de tickets")}</Link>}
          {isMasterIdentity(user) && <Link href="/admin/administrators" className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-accent">{t("Administradores")}</Link>}
          {isMasterIdentity(user) && <Link href="/admin" className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-accent">{t("Painel administrativo")}</Link>}
          {isMasterIdentity(user) && plan?.can_manage_benefits === true && <Link href="/admin/benefits" className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-accent">{t('Planos e benefícios')}</Link>}
          <form>
            <Button formAction={signOut} type="submit" variant="outline" size="sm">{t("Sair")}</Button>
          </form>
        </>} />
      </main>
    </div>
  )
}
