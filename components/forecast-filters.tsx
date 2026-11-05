'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ChevronDown, Filter } from 'lucide-react'
import type { SharedFilters } from '@/lib/use-shared-filters'

/** Card with a clickable header that collapses its content. Open/closed is remembered per storageKey. */
export function CollapsibleCard({ title, icon, storageKey, summary, children }: { title: string; icon: ReactNode; storageKey: string; summary?: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    try { if (localStorage.getItem(storageKey) === 'closed') setOpen(false) } catch { /* ignore */ }
  }, [storageKey])
  const toggle = () => setOpen(o => {
    try { localStorage.setItem(storageKey, o ? 'closed' : 'open') } catch { /* ignore */ }
    return !o
  })
  return (
    <Card>
      <CardContent className="p-4">
        <button type="button" onClick={toggle} aria-expanded={open} className="w-full flex items-center justify-between gap-2 text-sm font-medium text-left">
          <span className="flex items-center gap-2">{icon}{title}{!open && summary && <span className="text-xs font-normal text-muted-foreground ml-2">{summary}</span>}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && <div className="mt-3">{children}</div>}
      </CardContent>
    </Card>
  )
}

type Field = 'includeLeads' | 'minConfidence' | 'state' | 'pm' | 'type' | 'months'

interface Props {
  f: SharedFilters
  set: <K extends keyof SharedFilters>(k: K, v: SharedFilters[K]) => void
  users: { id: string; name: string }[]
  fields?: Field[]
  storageKey: string
  pmLabel?: string
  extra?: ReactNode
}

const STATE_LABEL: Record<string, string> = { all: 'All states', WA: 'WA', OR: 'OR' }

/** The Forecast filter set, reused on the Sales Pipeline and Dashboard. */
export function ForecastFilters({ f, set, users, fields = ['includeLeads', 'minConfidence', 'state', 'pm', 'type', 'months'], storageKey, pmLabel = 'Project Manager', extra }: Props) {
  const has = (k: Field) => fields.includes(k)
  const confDisabled = has('includeLeads') && !f.includeLeads
  const pmName = f.pm === 'all' ? 'All PMs' : f.pm === 'none' ? 'No PM' : users.find(u => u.id === f.pm)?.name ?? 'PM'
  const summary = [
    has('includeLeads') ? (f.includeLeads ? 'Leads on' : 'Leads off') : null,
    has('minConfidence') && !confDisabled ? (f.minConfidence === '0' ? 'All confidence' : `≥ ${f.minConfidence}% conf.`) : null,
    has('state') ? STATE_LABEL[f.state] ?? f.state : null,
    has('pm') ? pmName : null,
    has('type') ? (f.type === 'all' ? 'All types' : f.type === 'install' ? 'Install' : 'Product') : null,
    has('months') ? `${f.months} mo` : null,
  ].filter(Boolean).join(' · ')

  return (
    <CollapsibleCard title="Filters" icon={<Filter className="h-4 w-4 text-primary" />} storageKey={storageKey} summary={summary}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
        {has('includeLeads') && (
          <div className="space-y-1.5">
            <Label className="text-xs">Include Leads</Label>
            <div className="flex items-center gap-2 h-9">
              <Switch checked={f.includeLeads} onCheckedChange={(v) => set('includeLeads', v)} />
              <span className="text-xs text-muted-foreground">{f.includeLeads ? 'On' : 'Off'}</span>
            </div>
          </div>
        )}
        {has('minConfidence') && (
          <div className="space-y-1.5">
            <Label className="text-xs">Lead Confidence</Label>
            <Select value={f.minConfidence} onValueChange={(v) => set('minConfidence', v)} disabled={confDisabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['0', '25', '50', '60', '75', '90'].map(c => <SelectItem key={c} value={c}>{c === '0' ? 'All leads' : `${c}% or more`}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {has('state') && (
          <div className="space-y-1.5">
            <Label className="text-xs">State</Label>
            <Select value={f.state} onValueChange={(v) => set('state', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                <SelectItem value="WA">Washington</SelectItem>
                <SelectItem value="OR">Oregon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {has('pm') && (
          <div className="space-y-1.5">
            <Label className="text-xs">{pmLabel}</Label>
            <Select value={f.pm} onValueChange={(v) => set('pm', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PMs</SelectItem>
                <SelectItem value="none">No PM assigned</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {has('type') && (
          <div className="space-y-1.5">
            <Label className="text-xs">Project Type</Label>
            <Select value={f.type} onValueChange={(v) => set('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="install">Install</SelectItem>
                <SelectItem value="product">Product sale</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {has('months') && (
          <div className="space-y-1.5">
            <Label className="text-xs">Horizon</Label>
            <Select value={f.months} onValueChange={(v) => set('months', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['6', '12', '18', '24'].map(m => <SelectItem key={m} value={m}>{m} months</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {extra}
      </div>
      <p className="text-xs text-muted-foreground mt-3">These filters are shared by the Dashboard, Sales Pipeline and Revenue Forecast.</p>
    </CollapsibleCard>
  )
}
