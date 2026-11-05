import { APCalendarClient } from './ap-calendar-client'
import { ensureAccess } from '@/lib/access-server'
export default async function APCalendarPage() { await ensureAccess('ap'); return <APCalendarClient /> }
