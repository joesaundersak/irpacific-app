'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { AddActionItemDialog } from '@/components/add-action-item-dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Users, UserX, AlertTriangle, Search, X } from 'lucide-react'

interface Item {
  id: string
  description: string
  status: string
  priority: string
  category: string | null
  source: string | null
  dueDate: string | null
  assignedToId: string | null
  assignedTo: { id: string; name: string } | null
  job: { id: string; jobCode: string; jobName: string } | null
  lead: { id: string; opportunityTitle: string } | null
  meeting: { id: string; title: string; meetingDate: string | null } | null
}
interface UserLite { id: string; name: string }
interface MeetingLite { id: string; title: string; meetingDate: string | null }

const NO_CHANGE = '__no_change'
const EMPTY_BULK = { assignedToId: NO_CHANGE, dueMode: NO_CHANGE, dueDate: '', priority: NO_CHANGE, status: NO_CHANGE, meetingId: NO_CHANGE }
const isAuto = (i: { source: string | null }) => i.source === 'auto-flag' || i.source === 'auto'

const CATEGORY_LABEL: Record<string, string> = {
  manual: 'Manual',
  missing_schedule: 'Missing schedule',
  no_pm: 'No PM',
  missing_info: 'Missing info',
  margin_alert: 'Margin alert',
  overdue_milestone: 'Overdue milestone',
  stale_lead: 'Stale lead',
}
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }
const PRIORITY_CLASS: Record<string, string> = {
  high: 'text-red-700',
  medium: 'text-amber-700',
  low: 'text-muted-foreground',
}

export function ActionItemsClient({ initialUser }: { initialUser: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [users, setUsers] = useState<UserLite[]>([])
  const [loading, setLoading] = useState(true)
  const [person, setPerson] = useState(initialUser)
  const [status, setStatus] = useState('open')
  const [category, setCategory] = useState('all')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [autoOnly, setAutoOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [today, setToday] = useState('')
  const [meetings, setMeetings] = useState<MeetingLite[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState(EMPTY_BULK)
  const [applying, setApplying] = useState(false)

  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)) }, [])
  useEffect(() => { setPerson(initialUser) }, [initialUser])

  const load = useCallback(async () => {
    try {
      const [a, u, m] = await Promise.all([fetch('/api/action-items'), fetch('/api/users'), fetch('/api/meetings')])
      if (!a.ok) throw new Error('Failed to load action items')
      const aj = await a.json()
      const uj = u.ok ? await u.json() : { users: [] }
      const mj = m.ok ? await m.json() : { meetings: [] }
      setItems(aj.items ?? [])
      setUsers((uj.users ?? []).map((x: any) => ({ id: x.id, name: x.name })))
      setMeetings((mj.meetings ?? []).map((x: any) => ({ id: x.id, title: x.title, meetingDate: x.meetingDate ?? null })))
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const isOverdue = (i: Item) => !!today && !!i.dueDate && i.status !== 'complete' && i.dueDate.slice(0, 10) < today

  const cards = useMemo(() => {
    const open = items.filter(i => i.status !== 'complete')
    const stat = (list: Item[]) => ({
      open: list.length,
      overdue: list.filter(isOverdue).length,
      high: list.filter(i => i.priority === 'high').length,
    })
    const result = [{ key: 'all', name: 'Everyone', ...stat(open) }]
    for (const u of users) result.push({ key: u.id, name: u.name, ...stat(open.filter(i => i.assignedToId === u.id)) })
    const un = open.filter(i => !i.assignedToId)
    if (un.length > 0) result.push({ key: 'unassigned', name: 'Unassigned', ...stat(un) })
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, users, today])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter(i => person === 'all' ? true : person === 'unassigned' ? !i.assignedToId : i.assignedToId === person)
      .filter(i => status === 'all' ? true : status === 'open' ? i.status !== 'complete' : i.status === status)
      .filter(i => category === 'all' ? true : (i.category ?? 'manual') === category)
      .filter(i => !overdueOnly || isOverdue(i))
      .filter(i => !autoOnly || isAuto(i))
      .filter(i => !q || [i.description, i.job?.jobCode, i.job?.jobName, i.lead?.opportunityTitle, i.assignedTo?.name]
        .some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => {
        const o = Number(isOverdue(b)) - Number(isOverdue(a))
        if (o) return o
        const p = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1)
        if (p) return p
        return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, person, status, category, overdueOnly, autoOnly, search, today])

  const selectPerson = (key: string) => {
    setPerson(key)
    router.replace(key === 'all' ? '/action-items' : `/action-items?user=${key}`, { scroll: false })
  }

  const update = async (id: string, patch: Partial<Item>) => {
    const prev = items
    setItems(list => list.map(i => i.id === id ? {
      ...i, ...patch,
      ...(patch.assignedToId !== undefined ? { assignedTo: users.find(u => u.id === patch.assignedToId) ?? null } : {}),
    } : i))
    try {
      const res = await fetch('/api/action-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Update failed')
    } catch (e: any) {
      console.error(e)
      setItems(prev)
      toast.error(e?.message ?? 'Update failed')
    }
  }

  const clearFilters = () => { setStatus('open'); setCategory('all'); setOverdueOnly(false); setAutoOnly(false); setSearch('') }

  const shownIds = rows.map(r => r.id)
  // Only rows currently shown can stay selected, so a bulk edit never touches hidden items
  useEffect(() => {
    setSelected(s => {
      const shown = new Set(rows.map(r => r.id))
      const n = new Set(Array.from(s).filter(id => shown.has(id)))
      return n.size === s.size ? s : n
    })
  }, [rows])
  const allShownSelected = shownIds.length > 0 && shownIds.every(id => selected.has(id))
  const someShownSelected = shownIds.some(id => selected.has(id))
  const toggleOne = (id: string, on: boolean) => setSelected(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n })
  const toggleAllShown = (on: boolean) => setSelected(s => { const n = new Set(s); shownIds.forEach(id => on ? n.add(id) : n.delete(id)); return n })

  const applyBulk = async () => {
    const patch: Record<string, string | null> = {}
    if (bulk.assignedToId !== NO_CHANGE) patch.assignedToId = bulk.assignedToId === 'none' ? null : bulk.assignedToId
    if (bulk.dueMode === 'set') {
      if (!bulk.dueDate) { toast.error('Pick a due date'); return }
      patch.dueDate = bulk.dueDate
    } else if (bulk.dueMode === 'clear') patch.dueDate = null
    if (bulk.priority !== NO_CHANGE) patch.priority = bulk.priority
    if (bulk.status !== NO_CHANGE) patch.status = bulk.status
    if (bulk.meetingId !== NO_CHANGE) patch.meetingId = bulk.meetingId === 'none' ? null : bulk.meetingId
    if (Object.keys(patch).length === 0) { toast.error('Choose at least one field to change'); return }
    setApplying(true)
    try {
      const res = await fetch('/api/action-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), patch }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error ?? 'Bulk update failed')
      toast.success(`Updated ${j.updated} item${j.updated === 1 ? '' : 's'}`)
      setSelected(new Set())
      setBulk(EMPTY_BULK)
      await load()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message ?? 'Bulk update failed')
    } finally {
      setApplying(false)
    }
  }
  const selectedName = cards.find(c => c.key === person)?.name ?? 'Everyone'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Action Items"
        description="Who is responsible for what. Click a person to see and manage their action items."
        actions={
          <AddActionItemDialog
            users={users}
            size="default"
            label="New Action Item"
            defaultAssigneeId={person !== 'all' && person !== 'unassigned' ? person : null}
            onCreated={load}
          />
        }
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {cards.map(c => (
          <button
            key={c.key}
            type="button"
            onClick={() => selectPerson(c.key)}
            className={cn(
              'text-left rounded-lg bg-card p-4 shadow-sm transition hover:shadow-md border-2',
              person === c.key ? 'border-primary' : 'border-transparent',
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium truncate">
              {c.key === 'all' ? <Users className="h-4 w-4 text-primary" /> : c.key === 'unassigned' ? <UserX className="h-4 w-4 text-amber-600" /> : null}
              <span className="truncate">{c.name}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold">{c.open}</div>
            <div className="text-xs text-muted-foreground">open items</div>
            <div className="mt-2 flex gap-2 text-xs">
              <span className={c.overdue ? 'text-red-700 font-medium' : 'text-muted-foreground'}>{c.overdue} overdue</span>
              <span className="text-muted-foreground">·</span>
              <span className={c.high ? 'text-amber-700 font-medium' : 'text-muted-foreground'}>{c.high} high</span>
            </div>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search items, jobs, leads…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open (not complete)</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={overdueOnly} onCheckedChange={v => setOverdueOnly(v === true)} />
            Overdue only
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={autoOnly} onCheckedChange={v => setAutoOnly(v === true)} />
            Auto-created only
          </label>
          <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" />Clear</Button>
          <span className="ml-auto text-sm text-muted-foreground">{selectedName} — {rows.length} item{rows.length === 1 ? '' : 's'}</span>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card className="border-2 border-primary/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-sm">{selected.size} selected — bulk edit</span>
              <span className="text-xs text-muted-foreground">Fields left on “No change” are not touched.</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}><X className="h-4 w-4 mr-1" />Clear selection</Button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 items-end">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Assigned to</span>
                <Select value={bulk.assignedToId} onValueChange={v => setBulk(b => ({ ...b, assignedToId: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANGE}>No change</SelectItem>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Due</span>
                <Select value={bulk.dueMode} onValueChange={v => setBulk(b => ({ ...b, dueMode: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANGE}>No change</SelectItem>
                    <SelectItem value="set">Set date…</SelectItem>
                    <SelectItem value="clear">Clear due date</SelectItem>
                  </SelectContent>
                </Select>
                {bulk.dueMode === 'set' && (
                  <Input type="date" className="h-9" value={bulk.dueDate} onChange={e => setBulk(b => ({ ...b, dueDate: e.target.value }))} />
                )}
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Priority</span>
                <Select value={bulk.priority} onValueChange={v => setBulk(b => ({ ...b, priority: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANGE}>No change</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <Select value={bulk.status} onValueChange={v => setBulk(b => ({ ...b, status: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANGE}>No change</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Meeting</span>
                <Select value={bulk.meetingId} onValueChange={v => setBulk(b => ({ ...b, meetingId: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANGE}>No change</SelectItem>
                    <SelectItem value="none">Next meeting (unattached)</SelectItem>
                    {meetings.map(m => <SelectItem key={m.id} value={m.id}>{m.title}{m.meetingDate ? ` — ${m.meetingDate.slice(0, 10)}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={applyBulk} disabled={applying}>{applying ? 'Applying…' : `Apply to ${selected.size}`}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all shown items"
                    checked={allShownSelected ? true : someShownSelected ? 'indeterminate' : false}
                    onCheckedChange={v => toggleAllShown(v === true)}
                  />
                </TableHead>
                <TableHead className="min-w-[280px]">Action item</TableHead>
                <TableHead className="w-44">Assigned to</TableHead>
                <TableHead className="w-40">Due</TableHead>
                <TableHead className="w-32">Priority</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-40">Meeting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No action items match these filters.</TableCell></TableRow>
              ) : rows.map(i => (
                <TableRow key={i.id} className={cn(i.status === 'complete' && 'opacity-60', selected.has(i.id) && 'bg-primary/5')}>
                  <TableCell>
                    <Checkbox aria-label="Select item" checked={selected.has(i.id)} onCheckedChange={v => toggleOne(i.id, v === true)} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{i.description}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant="outline">{CATEGORY_LABEL[i.category ?? 'manual'] ?? i.category}</Badge>
                      {i.source === 'auto-flag' && <Badge variant="secondary">Auto — fix in BuilderTrend</Badge>}
                      {isOverdue(i) && <Badge className="bg-red-600 hover:bg-red-600 text-white"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>}
                      {i.job && <Link href={`/projects/${i.job.id}`} className="text-primary hover:underline">{i.job.jobCode} · {i.job.jobName}</Link>}
                      {i.lead && <span className="text-muted-foreground">Lead: {i.lead.opportunityTitle}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={i.assignedToId ?? 'none'} onValueChange={v => update(i.id, { assignedToId: v === 'none' ? null : v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      className="h-8"
                      value={i.dueDate ? i.dueDate.slice(0, 10) : ''}
                      onChange={e => update(i.id, { dueDate: e.target.value || null })}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={i.priority} onValueChange={v => update(i.id, { priority: v })}>
                      <SelectTrigger className={cn('h-8', PRIORITY_CLASS[i.priority])}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={i.status} onValueChange={v => update(i.id, { status: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm">
                    {i.meeting
                      ? <Link href={`/meetings/${i.meeting.id}`} className="text-primary hover:underline">{i.meeting.title}</Link>
                      : <span className="text-muted-foreground">Next meeting</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
