import { MeetingsClient } from './meetings-client'
import { ensureAccess } from '@/lib/access-server'
export default async function MeetingsPage() { const user = await ensureAccess('meetings'); return <MeetingsClient canDelete={user.access.deleteMeetings} /> }
