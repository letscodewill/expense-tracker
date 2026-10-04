import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isMasterIdentity } from '@/lib/tickets'
import { AdministratorsPanel, type Administrator } from '@/components/administrators-panel'

export default async function AdministratorsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) redirect('/login')
  if (!isMasterIdentity(data.user)) notFound()
  const owner = await supabase.rpc('is_support_owner')
  const result = !owner.error && owner.data === true ? await supabase.rpc('list_ticket_administrators') : null
  return <div className="container mx-auto max-w-4xl p-4 md:p-8">
    <header className="material-app-bar mb-6 flex items-center justify-between gap-4">
      <h1 className="text-3xl font-medium">Administradores</h1>
      <Link href="/" className="text-primary hover:underline">Voltar ao Dashboard</Link>
    </header>
    {!result || result.error ? <p role="alert">Não foi possível carregar os administradores. Aplique a migração de administradores no Supabase e tente novamente.</p>
      : <AdministratorsPanel administrators={(result.data ?? []) as Administrator[]} />}
  </div>
}
