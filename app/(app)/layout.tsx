import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AppShell } from '@/components/layouts/app-shell'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }
  return (
    <AppShell sidebar={<AppSidebar />} header={<AppHeader />}>
      {children}
    </AppShell>
  )
}
