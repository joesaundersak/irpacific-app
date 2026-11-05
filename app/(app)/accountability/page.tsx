import { AccountabilityClient } from './accountability-client'
import { ensureAccess } from '@/lib/access-server'

export default async function AccountabilityPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  await ensureAccess('accountability')
  const { user } = await searchParams
  return <AccountabilityClient initialUser={user ?? 'all'} />
}
