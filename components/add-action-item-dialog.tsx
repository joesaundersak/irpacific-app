'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ClipboardPlus } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  jobId?: string
  leadId?: string
  defaultAssigneeId?: string | null
  defaultDescription?: string
  users: { id: string; name: string }[]
  label?: string
  size?: 'sm' | 'default'
  onCreated?: () => void
}

export function AddActionItemDialog({ jobId, leadId, defaultAssigneeId, defaultDescription = '', users, label = 'Action Item', size = 'sm', onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ description: '', assignedToId: '', dueDate: '', priority: 'medium' })

  const openDialog = () => {
    setForm({ description: defaultDescription, assignedToId: defaultAssigneeId ?? '', dueDate: '', priority: 'medium' })
    setOpen(true)
  }

  const save = async () => {
    if (!form.description.trim()) { toast.error('Enter a description'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, description: form.description.trim(), jobId, leadId, nextMeeting: true, category: 'manual' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Failed to add action item'); return }
      toast.success(data.meetingTitle ? `Added to ${data.meetingTitle}` : 'Added — it will be on the agenda of the next meeting you create')
      setOpen(false)
      onCreated?.()
    } catch { toast.error('Failed to add action item') } finally { setSaving(false) }
  }

  return (
    <>
      <Button size={size} variant="outline" onClick={openDialog}>
        <ClipboardPlus className="h-3.5 w-3.5 mr-1" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Action Item</DialogTitle>
            <DialogDescription>It will be added to the next team meeting agenda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Assign to</Label>
                <Select value={form.assignedToId || 'none'} onValueChange={(v) => setForm(f => ({ ...f, assignedToId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Due date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add to Next Meeting'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
