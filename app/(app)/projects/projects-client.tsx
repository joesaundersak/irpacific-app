'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ArrowRight, CalendarX, UserX } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'

export function ProjectsClient() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ pm: '', state: '', status: '', flag: '' })
  const [users, setUsers] = useState<any[]>([])
  const [flagCounts, setFlagCounts] = useState<{ missingSchedule: number; noPm: number } | null>(null)

  const loadData = useCallback(() => {
    const params = new URLSearchParams()
    if (filter.pm) params.set('pm', filter.pm)
    if (filter.state) params.set('state', filter.state)
    if (filter.status) params.set('status', filter.status)
    if (filter.flag === 'active') params.set('active', 'true')
    else if (filter.flag) params.set('flag', filter.flag)
    fetch(`/api/projects?${params}`)
      .then(r => r.json())
      .then(d => { setJobs(d.jobs ?? []); setFlagCounts(d.flagCounts ?? null) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('flag')
    if (f && ['missing_schedule', 'no_pm', 'any', 'active'].includes(f)) setFilter(prev => ({ ...prev, flag: f }))
  }, [])
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users ?? [])).catch(console.error)
  }, [])

  const marginBadge = (health: string) => {
    const colors: Record<string, string> = { green: 'bg-green-100 text-green-700', yellow: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700' }
    return colors[health] ?? 'bg-gray-100'
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Active job tracking with financial and milestone views" />
      <FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Card className="cursor-pointer" onClick={() => setFilter(f => ({ ...f, flag: 'missing_schedule' }))}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 text-red-600"><CalendarX className="h-4 w-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Active projects missing schedule phases</p>
                <p className="text-lg font-bold text-red-600">{filter.flag === 'no_pm' ? '—' : flagCounts?.missingSchedule ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setFilter(f => ({ ...f, flag: 'no_pm' }))}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 text-red-600"><UserX className="h-4 w-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Active projects with no PM assigned</p>
                <p className="text-lg font-bold text-red-600">{filter.flag === 'missing_schedule' ? '—' : flagCounts?.noPm ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3">
            <Select value={filter.pm} onValueChange={(v) => setFilter(f => ({ ...f, pm: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All PMs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PMs</SelectItem>
                {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filter.state} onValueChange={(v) => setFilter(f => ({ ...f, state: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="All States" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="WA">Washington</SelectItem>
                <SelectItem value="OR">Oregon</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filter.flag} onValueChange={(v) => setFilter(f => ({ ...f, flag: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="any">Flagged (any)</SelectItem>
                <SelectItem value="missing_schedule">Missing Schedule</SelectItem>
                <SelectItem value="no_pm">No PM Assigned</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Code</TableHead>
                    <TableHead>Project Name</TableHead>
                    <TableHead>PM</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead className="text-right">Contract</TableHead>
                    <TableHead className="text-right">Actual Costs</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">% Complete</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : jobs.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No projects found for these filters.</TableCell></TableRow>
                  ) : (
                    jobs.map((job: any) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-sm font-medium">{job.jobCode}</TableCell>
                        <TableCell className="text-sm max-w-[250px] truncate">{job.jobName}</TableCell>
                        <TableCell className="text-sm">{job.projectManager?.name ?? '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{job.state ?? '—'}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {job.flags?.includes('missing_schedule') && (
                              <Badge className="text-[10px] bg-red-100 text-red-700" title={`Missing: ${(job.missingPhases ?? []).join(', ')}`}>
                                {job.missingPhases?.length === job.totalPhases ? 'No schedule' : `Missing ${job.missingPhases?.length} phase${job.missingPhases?.length === 1 ? '' : 's'}`}
                              </Badge>
                            )}
                            {job.flags?.includes('no_pm') && <Badge className="text-[10px] bg-red-100 text-red-700">No PM</Badge>}
                            {job.isActive && job.flags?.length === 0 && <Badge className="text-[10px] bg-green-100 text-green-700">Scheduled</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(job.totalRevisedPrice)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(job.actualCosts)}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={`text-xs ${marginBadge(job.marginHealth)}`}>{formatPercent(job.computedMargin)}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatPercent(job.percentComplete)}</TableCell>
                        <TableCell>
                          <Link href={`/projects/${job.id}`} className="text-primary hover:underline">
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
