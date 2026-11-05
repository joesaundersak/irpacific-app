import { ProjectDetailClient } from './project-detail-client'
import { ensureAccess } from '@/lib/access-server'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureAccess('projects')
  const { id } = await params
  return <ProjectDetailClient projectId={id} />
}
