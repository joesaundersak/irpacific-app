import { ImportsClient } from './imports-client'
import { ensureAccess } from '@/lib/access-server'
export default async function ImportsPage() { await ensureAccess('imports'); return <ImportsClient /> }
