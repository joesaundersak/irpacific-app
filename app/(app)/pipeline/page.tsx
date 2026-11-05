import { PipelineClient } from './pipeline-client'
import { ensureAccess } from '@/lib/access-server'
export default async function PipelinePage() { await ensureAccess('pipeline'); return <PipelineClient /> }
