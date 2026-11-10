import { ReceivablesClient } from './receivables-client'
import { ensureAccess } from '@/lib/access-server'
export default async function ReceivablesPage() { await ensureAccess('receivables'); return <ReceivablesClient /> }
