'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ArrowLeft, Send, Plus, CheckCircle, Clock, AlertTriangle, Users, Trophy } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'

export function MeetingDetailClient({ meetingId }: { meetingId: string }) {
  const [meeting, setMeeting] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState({ description: '', assignedToId: '', dueDate: '', priority: 'medium' })
  const [sending, setSending] = useState(false)

  const loadMeeting = () => {
    fetch(`/api/meetings/${meetingId}`)
      .then(r => r.json())
      .then(d => { setMeeting(d); setNotes(d?.notes ?? '') })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadMeeting()
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d?.users ?? [])).catch(console.error)
  }, [meetingId])

  const saveNotes = async () => {
    await fetch(`/api/meetings/${meetingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    toast.success('Notes saved')
  }

  const sendSummary = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/meetings/${meetingId}/send-summary`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (data?.failed?.length) toast.warning(`Summary sent to ${data.sent}; failed for ${data.failed.join(', ')}`)
        else toast.success('Summary sent to all team members')
        loadMeeting()
      } else toast.error(data?.error ?? 'Failed to send summary')
    } catch { toast.error('Error sending summary') }
    finally { setSending(false) }
  }

  const addActionItem = async () => {
    try {
      await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newItem, meetingId }),
      })
      toast.success('Action item added')
      setShowAddItem(false)
      setNewItem({ description: '', assignedToId: '', dueDate: '', priority: 'medium' })
      loadMeeting()
    } catch { toast.error('Failed to add') }
  }

  const updateItemStatus = async (id: string, status: string) => {
    await fetch('/api/action-items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    toast.success(`Status updated`)
    loadMeeting()
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
  if (!meeting) return <div className="flex items-center justify-center py-20 text-muted-foreground">Meeting not found</div>

  const priorityColor: Record<string, string> = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-blue-100 text-blue-700' }
  const statusIcon = (s: string) => s === 'complete' ? <CheckCircle className="h-3 w-3 text-green-600" /> : s === 'in_progress' ? <Clock className="h-3 w-3 text-blue-600" /> : <AlertTriangle className="h-3 w-3 text-amber-600" />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/meetings"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <PageHeader
          title={meeting?.title ?? 'Meeting'}
          description={`${formatDate(meeting?.meetingDate)} • Created by ${meeting?.createdBy?.name ?? 'Unknown'}`}
          actions={
            <Button onClick={sendSummary} disabled={sending}>
              <Send className="h-4 w-4 mr-2" />{sending ? 'Sending...' : 'Send Summary'}
            </Button>
          }
        />
      </div>

      {(meeting?.scoreboard?.length ?? 0) > 0 && (
        <FadeIn>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" />Action Item Scoreboard</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(meeting?.scoreboard ?? []).map((p: any) => (
                  <div key={p.userId} className="bg-muted rounded-lg p-3">
                    <p className="text-sm font-medium mb-2">{p.name}</p>
                    <div className="flex gap-3 text-xs">
                      <span className="text-amber-600">{p.open} open</span>
                      <span className="text-green-600">{p.completed} done</span>
                      {p.overdue > 0 && <span className="text-red-600">{p.overdue} overdue</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Action Items ({meeting?.actionItems?.length ?? 0})</CardTitle>
              <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Add Item</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Action Item</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Description</Label><Input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} /></div>
                    <div><Label>Assigned To</Label>
                      <Select value={newItem.assignedToId} onValueChange={v => setNewItem(p => ({ ...p, assignedToId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                        <SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Due Date</Label><Input type="date" value={newItem.dueDate} onChange={e => setNewItem(p => ({ ...p, dueDate: e.target.value }))} /></div>
                    <div><Label>Priority</Label>
                      <Select value={newItem.priority} onValueChange={v => setNewItem(p => ({ ...p, priority: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={addActionItem} className="w-full">Add Action Item</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(meeting?.actionItems ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No action items</TableCell></TableRow>
                ) : (
                  (meeting?.actionItems ?? []).map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm max-w-[300px]">
                        <p className={item.status === 'complete' ? 'line-through text-muted-foreground' : ''}>{item.description}</p>
                      </TableCell>
                      <TableCell className="text-sm">{item.assignedTo?.name ?? '—'}</TableCell>
                      <TableCell><Badge className={`text-xs ${priorityColor[item.priority] ?? ''}`}>{item.priority}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{item.category}</Badge></TableCell>
                      <TableCell className="text-sm">{formatDate(item.dueDate)}</TableCell>
                      <TableCell>
                        <Select value={item.status} onValueChange={v => updateItemStatus(item.id, v)}>
                          <SelectTrigger className="h-7 text-xs w-[110px]">
                            <div className="flex items-center gap-1">{statusIcon(item.status)}<SelectValue /></div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="complete">Complete</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.2}>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Meeting Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={6} placeholder="Add meeting notes here..." />
            <Button onClick={saveNotes} variant="outline" size="sm">Save Notes</Button>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
