'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Users, Plus, ArrowRight, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { toast } from 'sonner'
import { DeleteMeetingButton } from '@/components/delete-meeting-button'

export function MeetingsClient({ canDelete = false }: { canDelete?: boolean }) {
  const [meetings, setMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('Weekly Meeting')
  const [newDate, setNewDate] = useState('')
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  const loadMeetings = () => {
    fetch('/api/meetings')
      .then(r => r.json())
      .then(d => setMeetings(d.meetings ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadMeetings() }, [])

  const createMeeting = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, meetingDate: newDate ? new Date(newDate).toISOString() : new Date().toISOString() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.id) {
        toast.success('Meeting created — opening agenda')
        setShowCreate(false)
        router.push(`/meetings/${data.id}`)
      } else toast.error(data?.error ?? 'Failed to create meeting')
    } catch { toast.error('Error creating meeting') }
    finally { setCreating(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Meetings"
        description="Weekly meeting hub with action items and accountability tracking"
        actions={
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Meeting</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Meeting</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Title</Label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} /></div>
                <div><Label>Date</Label><Input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
                <Button onClick={createMeeting} className="w-full" disabled={creating}>{creating ? 'Creating…' : 'Create & Generate Action Items'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <FadeIn>
        <Stagger className="space-y-3">
          {loading ? (
            <Card className="animate-pulse"><CardContent className="p-6"><div className="h-12 bg-muted rounded" /></CardContent></Card>
          ) : meetings.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
              <p>No meetings yet. Create your first weekly meeting to get started.</p>
            </CardContent></Card>
          ) : (
            meetings.map((m: any) => (
              <StaggerItem key={m.id}>
                <Card className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-0 flex items-center">
                    <Link href={`/meetings/${m.id}`} className="flex-1 p-4 flex items-center justify-between gap-4 min-w-0">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(m.meetingDate)} • {m._count?.actionItems ?? 0} action items</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.summarySent && <Badge variant="outline" className="text-xs text-green-600">Summary Sent</Badge>}
                        <Badge variant="secondary" className="text-xs">{m.status}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                    {canDelete && (
                      <div className="pr-3">
                        <DeleteMeetingButton meetingId={m.id} title={m.title} iconOnly onDeleted={() => setMeetings(prev => prev.filter(x => x.id !== m.id))} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            ))
          )}
        </Stagger>
      </FadeIn>
    </div>
  )
}
