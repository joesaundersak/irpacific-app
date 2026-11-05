'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/format'

interface PhaseStatus { key: string; label: string; count: number; start: string | null; end: string | null }

export function ScheduleRequirements({ job }: { job: any }) {
  const ev = job.scheduleEval as { type: 'install' | 'product'; missing: string[]; complete: boolean; phases: PhaseStatus[] }
  if (!ev) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-medium">Required Schedule Phases</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {ev.type === 'install' ? 'Installation project' : 'Product-only sale'} — phase dates come from the BuilderTrend schedule. This view only reports what is missing.
            </p>
          </div>
          <Badge variant="outline" className="text-xs" title="Set in BuilderTrend: add the Job Group 'Product Only' for product sales">
            {ev.type === 'install' ? 'Install' : 'Product Only'}
          </Badge>
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
                {p.count > 0 ? `${formatDate(p.start)}${p.end && p.end !== p.start ? ` – ${formatDate(p.end)}` : ''}` : 'Not in BuilderTrend schedule'}
              </p>
            </div>
          ))}
        </div>

        {!ev.complete && (
          <div className="flex items-start gap-2 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Missing in BuilderTrend: {ev.missing.join(', ')}. An action item is assigned to {job.projectManager?.name ?? 'the Admin (no PM assigned)'} to add these dates in BuilderTrend and re-import.</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Install vs. product is read from BuilderTrend: jobs in the Job Group “Product Only” are product sales; everything else is treated as an installation.</p>
        {!job.isActive && <Badge variant="secondary" className="text-xs">Job is complete or closed — not flagged</Badge>}
      </CardContent>
    </Card>
  )
}
