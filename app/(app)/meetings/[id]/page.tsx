import { MeetingDetailClient } from './meeting-detail-client'
import { ensureAccess } from '@/lib/access-server'

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureAccess('meetings')
  const { id } = await params
  return <MeetingDetailClient meetingId={id} />
}
