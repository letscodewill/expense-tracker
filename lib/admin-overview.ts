export type AdminAccount = {
  id: string
  email: string | null
  name: string
  created_at: string
  confirmed: boolean
  last_access: string | null
  last_action: string | null
}
export type AdminOverview = {
  summary: { registered: number; confirmed: number; active7: number; active30: number; used30: number; new30: number }
  users: AdminAccount[]
  matching: number
}
