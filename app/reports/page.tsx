import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportsView } from '@/components/reports-view'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default async function ReportsPage() {
  const supabase = await createClient()

  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch (err) {
    console.warn('[reports] getUser failed, redirecting to /login:', err)
    redirect('/login')
  }

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex items-center gap-4 mb-8">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Relatórios</h1>
      </header>
      <main>
        <ReportsView />
      </main>
    </div>
  )
}