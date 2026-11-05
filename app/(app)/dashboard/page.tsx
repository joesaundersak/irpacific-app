import { DashboardClient } from './dashboard-client'
import { ensureAccess } from '@/lib/access-server'

export default async function DashboardPage() {
  await ensureAccess('dashboard')
  return <DashboardClient />
}
