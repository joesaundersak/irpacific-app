import { ActionItemsClient } from './action-items-client'
import { ensureAccess } from '@/lib/access-server'

export default async function ActionItemsPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  // Access key stays 'accountability' so saved per-user permissions keep working
  await ensureAccess('accountability')
  const { user } = await searchParams
  return <ActionItemsClient initialUser={user ?? 'all'} />
}
