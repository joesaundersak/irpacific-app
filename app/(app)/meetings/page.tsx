import { MeetingsClient } from './meetings-client'
import { ensureAccess } from '@/lib/access-server'
export default async function MeetingsPage() { await ensureAccess('meetings'); return <MeetingsClient /> }
