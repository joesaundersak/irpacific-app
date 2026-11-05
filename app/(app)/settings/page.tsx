import { SettingsClient } from './settings-client'
import { ensureAccess } from '@/lib/access-server'

export default async function SettingsPage() {
  const user = await ensureAccess('settings', 'users')
  return <SettingsClient canConfig={user.access.settings} canUsers={user.access.users} isAdmin={user.role === 'Admin'} currentUserId={user.id} />
}
