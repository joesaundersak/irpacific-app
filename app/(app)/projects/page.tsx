import { ProjectsClient } from './projects-client'
import { ensureAccess } from '@/lib/access-server'
export default async function ProjectsPage() { await ensureAccess('projects'); return <ProjectsClient /> }
