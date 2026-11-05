import { ForecastClient } from './forecast-client'
import { ensureAccess } from '@/lib/access-server'
export default async function ForecastPage() { await ensureAccess('forecast'); return <ForecastClient /> }
