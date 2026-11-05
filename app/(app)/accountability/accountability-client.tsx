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

export function AccountabilityClient({ initialUser }: { initialUser: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [users, setUsers] = useState<UserLite[]>([])
  const [loading, setLoading] = useState(true)
  const [person, setPerson] = useState(initialUser)
  const [status, setStatus] = useState('open')
  const [category, setCategory] = useState('all')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [today, setToday] = useState('')

  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)) }, [])
  useEffect(() => { setPerson(initialUser) }, [initialUser])

  const load = useCallback(async () => {
    try {
      const [a, u] = await Promise.all([fetch('/api/action-items'), fetch('/api/users')])
      if (!a.ok) throw new Error('Failed to load action items')
      const aj = await a.json()
      const uj = u.ok ? await u.json() : { users: [] }
      setItems(aj.items ?? [])
      setUsers((uj.users ?? []).map((x: any) => ({ id: x.id, name: x.name })))
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
  }, [items, person, status, category, overdueOnly, search, today])

  const selectPerson = (key: string) => {
    setPerson(key)
    router.replace(key === 'all' ? '/accountability' : `/accountability?user=${key}`, { scroll: false })
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

  const clearFilters = () => { setStatus('open'); setCategory('all'); setOverdueOnly(false); setSearch('') }
  const selectedName = cards.find(c => c.key === person)?.name ?? 'Everyone'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accountability"
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
          <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" />Clear</Button>
          <span className="ml-auto text-sm text-muted-foreground">{selectedName} — {rows.length} item{rows.length === 1 ? '' : 's'}</span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No action items match these filters.</TableCell></TableRow>
              ) : rows.map(i => (
                <TableRow key={i.id} className={cn(i.status === 'complete' && 'opacity-60')}>
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
