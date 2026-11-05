'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ArrowLeft, Send, Plus, CheckCircle, Clock, AlertTriangle, Users, Trophy, ListChecks, ArrowUp, Undo2 } from 'lucide-react'
import { itemHeading, itemBullets } from '@/lib/action-item-display'
import { formatDate } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { DeleteMeetingButton } from '@/components/delete-meeting-button'

const POLL_MS = 5000

function ItemDescription({ item }: { item: any }) {
  const heading = itemHeading(item)
  const bullets = itemBullets(item)
  const done = item.status === 'complete'
  return (
    <div className={done ? 'line-through text-muted-foreground' : ''}>
      {heading && <p className="font-semibold">{heading}</p>}
      <ul className="list-disc pl-5 mt-1 space-y-0.5">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    </div>
  )
}

export function MeetingDetailClient({ meetingId, canDelete = false }: { meetingId: string; canDelete?: boolean }) {
  const router = useRouter()
  const [meeting, setMeeting] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState({ description: '', assignedToId: '', dueDate: '', priority: 'medium' })
  const [sending, setSending] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastSync, setLastSync] = useState<number | null>(null)
  const notesDirty = useRef(false)
  const busy = useRef(0)

  // Fetches the latest meeting. Used on load, after every change and by the live refresh.
  const loadMeeting = useCallback(async () => {
    try {
      const r = await fetch(`/api/meetings/${meetingId}`, { cache: 'no-store' })
      if (!r.ok) { if (r.status === 404) setMeeting(null); return }
      const d = await r.json()
      setMeeting(d)
      if (!notesDirty.current) setNotes(d?.notes ?? '')
      setLastSync(Date.now())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [meetingId])

  useEffect(() => {
    loadMeeting()
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d?.users ?? [])).catch(console.error)
  }, [loadMeeting])

  // Live updates: everyone in the meeting sees changes within a few seconds, no reload needed
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible' && busy.current === 0) loadMeeting() }
    const timer = setInterval(tick, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') loadMeeting() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible) }
  }, [loadMeeting])

  const items: any[] = meeting?.actionItems ?? []
  const committed = useMemo(() => items.filter(i => i.committed), [items])
  const suggested = useMemo(() => items.filter(i => !i.committed), [items])

  // Drop selections for items that moved or disappeared (e.g. someone else moved them)
  useEffect(() => {
    setSelected(prev => {
      const ids = new Set(suggested.map(i => i.id))
      const next = new Set([...prev].filter(id => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [suggested])

  const saveNotes = async () => {
    const res = await fetch(`/api/meetings/${meetingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    if (res.ok) { notesDirty.current = false; toast.success('Notes saved'); loadMeeting() }
    else toast.error('Failed to save notes')
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
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newItem, meetingId, committed: true }),
      })
      if (!res.ok) throw new Error()
      toast.success('Action item added')
      setShowAddItem(false)
      setNewItem({ description: '', assignedToId: '', dueDate: '', priority: 'medium' })
      loadMeeting()
    } catch { toast.error('Failed to add') }
  }

  // Optimistic single-item update, then refresh from the server
  const updateItem = async (id: string, patch: Record<string, any>, message?: string) => {
    busy.current++
    setMeeting((m: any) => m ? { ...m, actionItems: (m.actionItems ?? []).map((a: any) => a.id === id ? {
      ...a, ...patch,
      ...(patch.assignedToId !== undefined ? { assignedTo: users.find(u => u.id === patch.assignedToId) ?? null } : {}),
    } : a) } : m)
    try {
      const res = await fetch('/api/action-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.error ?? 'Update failed') }
      else if (message) toast.success(message)
    } catch { toast.error('Update failed') }
    finally { busy.current--; loadMeeting() }
  }

  const toggleSelected = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const moveSelected = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    busy.current++
    setMeeting((m: any) => m ? { ...m, actionItems: (m.actionItems ?? []).map((a: any) => ids.includes(a.id) ? { ...a, committed: true } : a) } : m)
    setSelected(new Set())
    try {
      const res = await fetch('/api/action-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, patch: { committed: true } }),
      })
      if (res.ok) toast.success(`Moved ${ids.length} to Meeting Action Items`)
      else { const d = await res.json().catch(() => ({})); toast.error(d?.error ?? 'Move failed') }
    } catch { toast.error('Move failed') }
    finally { busy.current--; loadMeeting() }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
  if (!meeting) return <div className="flex items-center justify-center py-20 text-muted-foreground">Meeting not found</div>

  const priorityColor: Record<string, string> = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-blue-100 text-blue-700' }
  const statusIcon = (s: string) => s === 'complete' ? <CheckCircle className="h-3 w-3 text-green-600" /> : s === 'in_progress' ? <Clock className="h-3 w-3 text-blue-600" /> : <AlertTriangle className="h-3 w-3 text-amber-600" />

  // Assigning someone in Suggested Actions moves the item up to Meeting Action Items
  const assigneeSelect = (item: any, moveOnAssign = false) => (
    <Select value={item.assignedToId ?? 'none'} onValueChange={v => {
      const assignedToId = v === 'none' ? null : v
      if (moveOnAssign && assignedToId) updateItem(item.id, { assignedToId, committed: true }, 'Assigned and moved to Meeting Action Items')
      else updateItem(item.id, { assignedToId })
    }}>
      <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue placeholder="Unassigned" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Unassigned</SelectItem>
        {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
  const prioritySelect = (item: any) => (
    <Select value={item.priority} onValueChange={v => updateItem(item.id, { priority: v })}>
      <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="high">High</SelectItem>
        <SelectItem value="medium">Medium</SelectItem>
        <SelectItem value="low">Low</SelectItem>
      </SelectContent>
    </Select>
  )
  const statusSelect = (item: any) => (
    <Select value={item.status} onValueChange={v => updateItem(item.id, { status: v })}>
      <SelectTrigger className="h-8 text-xs w-[120px]">
        <div className="flex items-center gap-1">{statusIcon(item.status)}<SelectValue /></div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="in_progress">In Progress</SelectItem>
        <SelectItem value="complete">Complete</SelectItem>
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/meetings"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <PageHeader
          title={meeting?.title ?? 'Meeting'}
          description={`${formatDate(meeting?.meetingDate)} • Created by ${meeting?.createdBy?.name ?? 'Unknown'}`}
          actions={
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title={lastSync ? 'Updates automatically every few seconds' : ''}>
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />Live
              </span>
              {canDelete && <DeleteMeetingButton meetingId={meetingId} title={meeting?.title ?? 'Meeting'} onDeleted={() => router.push('/meetings')} />}
              <Button onClick={sendSummary} disabled={sending}>
                <Send className="h-4 w-4 mr-2" />{sending ? 'Sending...' : 'Send Summary'}
              </Button>
            </div>
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
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" />Meeting Action Items ({committed.length})</CardTitle>
              <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Add Item</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Meeting Action Item</DialogTitle></DialogHeader>
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
                    <Button onClick={addActionItem} className="w-full" disabled={!newItem.description.trim()}>Add Action Item</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Items picked or assigned during this meeting. Assigning someone to a suggested action moves it here.</p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {committed.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No meeting action items yet. Select suggested actions below, or assign someone to one.</TableCell></TableRow>
                ) : committed.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm max-w-[420px] align-top"><ItemDescription item={item} /></TableCell>
                    <TableCell className="align-top">{assigneeSelect(item)}</TableCell>
                    <TableCell className="align-top">
                      <Input type="date" className="h-8 text-xs w-[140px]" value={item.dueDate ? String(item.dueDate).slice(0, 10) : ''}
                        onChange={e => updateItem(item.id, { dueDate: e.target.value || null })} />
                    </TableCell>
                    <TableCell className="align-top">{prioritySelect(item)}</TableCell>
                    <TableCell className="align-top">{statusSelect(item)}</TableCell>
                    <TableCell className="align-top">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Move back to Suggested Actions" onClick={() => updateItem(item.id, { committed: false }, 'Moved back to Suggested Actions')}>
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.15}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Suggested Actions ({suggested.length})</CardTitle>
              {selected.size > 0 && (
                <Button size="sm" onClick={moveSelected}><ArrowUp className="h-3 w-3 mr-1" />Move {selected.size} to Meeting Action Items</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input type="checkbox" aria-label="Select all suggested actions" className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={suggested.length > 0 && selected.size === suggested.length}
                      onChange={e => setSelected(e.target.checked ? new Set(suggested.map((i: any) => i.id)) : new Set())} />
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggested.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No suggested actions</TableCell></TableRow>
                ) : suggested.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="align-top">
                      <input type="checkbox" aria-label="Select action" className="h-4 w-4 mt-1 accent-[hsl(var(--primary))]"
                        checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)} />
                    </TableCell>
                    <TableCell className="text-sm max-w-[420px] align-top"><ItemDescription item={item} /></TableCell>
                    <TableCell className="align-top">{assigneeSelect(item, true)}</TableCell>
                    <TableCell className="align-top"><Badge className={`text-xs ${priorityColor[item.priority] ?? ''}`}>{item.priority}</Badge></TableCell>
                    <TableCell className="align-top"><Badge variant="outline" className="text-xs">{item.category}</Badge></TableCell>
                    <TableCell className="text-sm align-top">{formatDate(item.dueDate)}</TableCell>
                    <TableCell className="align-top">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Move to Meeting Action Items" onClick={() => updateItem(item.id, { committed: true }, 'Moved to Meeting Action Items')}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.2}>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Meeting Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={notes} onChange={e => { notesDirty.current = true; setNotes(e.target.value) }} rows={6} placeholder="Add meeting notes here..." />
            <Button onClick={saveNotes} variant="outline" size="sm">Save Notes</Button>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
