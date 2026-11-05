import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layouts/app-shell'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { getCurrentUser } from '@/lib/access-server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return (
    <AppShell sidebar={<AppSidebar access={user.access} />} header={<AppHeader />}>
      {children}
    </AppShell>
  )
}
