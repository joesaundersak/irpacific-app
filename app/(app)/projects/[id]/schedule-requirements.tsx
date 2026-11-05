'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { CheckCircle, AlertTriangle, Plus } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'

interface PhaseStatus { key: string; label: string; count: number; start: string | null; end: string | null }

export function ScheduleRequirements({ job, canEdit, canManage, users, onChange }: {
  job: any; canEdit: boolean; canManage: boolean; users: any[]; onChange: () => void
}) {
  const ev = job.scheduleEval as { type: 'install' | 'product'; missing: string[]; complete: boolean; phases: PhaseStatus[] }
  const [form, setForm] = useState({ phase: '', start: '', end: '' })
  const [saving, setSaving] = useState(false)

  const put = async (body: any, ok: string) => {
    const res = await fetch(`/api/projects/${job.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (res.ok) { toast.success(ok); onChange() } else toast.error(data.error ?? 'Update failed')
  }

  const addPhase = async () => {
    if (!form.phase || !form.start) { toast.error('Pick a phase and a start date'); return }
    if (form.end && form.end < form.start) { toast.error('End date is before start date'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${job.id}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: form.phase, title: form.phase, startDate: form.start, endDate: form.end || form.start, isRequired: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { toast.success(`${form.phase} dates added`); setForm({ phase: '', start: '', end: '' }); onChange() }
      else toast.error(data.error ?? 'Failed to add phase')
    } finally { setSaving(false) }
  }

  if (!ev) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-medium">Required Schedule Phases</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {ev.type === 'install' ? 'Install project' : 'Product sale'} — the PM must enter dates for every phase. These dates drive the revenue forecast.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Select value={job.scheduleType ?? 'auto'} onValueChange={(v) => put({ scheduleType: v === 'auto' ? null : v }, 'Project type updated')}>
                <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Type: Auto ({ev.type === 'install' ? 'Install' : 'Product'})</SelectItem>
                  <SelectItem value="install">Type: Install</SelectItem>
                  <SelectItem value="product">Type: Product Sale</SelectItem>
                </SelectContent>
              </Select>
            )}
            {canManage && (
              <Select value={job.projectManagerId ?? 'none'} onValueChange={(v) => put({ projectManagerId: v === 'none' ? null : v }, 'Project manager updated')}>
                <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Assign PM" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">PM: Unassigned</SelectItem>
                  {users.map((u: any) => <SelectItem key={u.id} value={u.id}>PM: {u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ev.phases.map(p => (
            <div key={p.key} className={`rounded-lg p-3 ${p.count > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                {p.count > 0 ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                <span className={p.count > 0 ? 'text-green-800' : 'text-red-800'}>{p.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {p.count > 0 ? `${formatDate(p.start)}${p.end && p.end !== p.start ? ` – ${formatDate(p.end)}` : ''}` : 'No dates entered'}
              </p>
            </div>
          ))}
        </div>

        {!ev.complete && (
          <div className="flex items-center gap-2 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Missing: {ev.missing.join(', ')}. An action item is assigned to {job.projectManager?.name ?? 'the Admin (no PM assigned)'}.
          </div>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-end gap-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Phase</Label>
              <Select value={form.phase} onValueChange={(v) => setForm(f => ({ ...f, phase: v }))}>
                <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="Select phase" /></SelectTrigger>
                <SelectContent>
                  {ev.phases.map(p => <SelectItem key={p.key} value={p.label}>{p.label}{p.count > 0 ? ' (has dates)' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start</Label>
              <Input type="date" className="h-9 w-[160px]" value={form.start} onChange={(e) => setForm(f => ({ ...f, start: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End / Deadline</Label>
              <Input type="date" className="h-9 w-[160px]" value={form.end} onChange={(e) => setForm(f => ({ ...f, end: e.target.value }))} />
            </div>
            <Button size="sm" onClick={addPhase} disabled={saving}><Plus className="h-3.5 w-3.5 mr-1" />Add Phase Dates</Button>
          </div>
        )}
        {!job.isActive && <Badge variant="secondary" className="text-xs">Job is complete or closed — not flagged</Badge>}
      </CardContent>
    </Card>
  )
}
