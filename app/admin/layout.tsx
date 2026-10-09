import { getTicketAccess } from '@/lib/tickets-server'
import { AdminTicketNotifications } from '@/components/admin-ticket-notifications'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { master } = await getTicketAccess()
  return <>{master && <div className="container mx-auto flex max-w-7xl justify-end px-4 pt-4 md:px-8"><AdminTicketNotifications /></div>}{children}</>
}
