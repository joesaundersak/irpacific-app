'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp, FolderKanban, AlertTriangle, Clock, Users, Upload, ArrowRight, CalendarX, UserX, FileWarning,
} from 'lucide-react'
import { formatCurrency, formatPercent, formatDate } from '@/lib/format'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'

interface DashboardData {
  weightedPipeline: number
  activeProjects: number
  atRiskCount: number
  staleLeads: number
  actionsByPerson: { id: string; name: string; count: number }[]
  recentImports: { id: string; fileName: string; fileType: string; recordsProcessed: number; importedBy: string; createdAt: string }[]
  top5AtRisk: { id: string; jobCode: string; jobName: string; pm: string; margin: number }[]
  upcomingMilestones: { id: string; title: string; phase: string; endDate: string; jobCode: string; jobName: string }[]
  targetMargin: number
  missingScheduleCount: number
  noPmCount: number
  missingInfoCount: number
}

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Operations overview" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-16 bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  const kpis = [
    { label: 'Weighted Pipeline', value: formatCurrency(data?.weightedPipeline), icon: TrendingUp, color: 'text-primary' },
    { label: 'Active Projects', value: String(data?.activeProjects ?? 0), icon: FolderKanban, color: 'text-blue-600' },
    { label: 'At-Risk Jobs', value: String(data?.atRiskCount ?? 0), icon: AlertTriangle, color: data?.atRiskCount ? 'text-red-500' : 'text-green-600' },
    { label: 'Stale Leads', value: String(data?.staleLeads ?? 0), icon: Clock, color: data?.staleLeads ? 'text-amber-500' : 'text-green-600' },
    { label: 'Open Actions', value: String((data?.actionsByPerson ?? []).reduce((s: number, a: any) => s + a.count, 0)), icon: Users, color: 'text-purple-600', href: '/accountability' },
    { label: 'Missing Schedules', value: String(data?.missingScheduleCount ?? 0), icon: CalendarX, color: data?.missingScheduleCount ? 'text-red-500' : 'text-green-600', href: '/projects?flag=missing_schedule' },
    { label: 'No PM Assigned', value: String(data?.noPmCount ?? 0), icon: UserX, color: data?.noPmCount ? 'text-red-500' : 'text-green-600', href: '/projects?flag=no_pm' },
    { label: 'Missing Info', value: String(data?.missingInfoCount ?? 0), icon: FileWarning, color: data?.missingInfoCount ? 'text-amber-500' : 'text-green-600', href: '/projects?flag=missing_info' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Real-time operations overview for Interior Resources" />
      <FadeIn>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi: any, i) => (
            <Card key={i} className={kpi.href ? 'hover:shadow-md transition-shadow' : ''}>
              <CardContent className="p-4">
                {kpi.href ? (
                  <Link href={kpi.href} className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${kpi.color}`}><kpi.icon className="h-4 w-4" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      <p className="text-lg font-bold tracking-tight">{kpi.value}</p>
                    </div>
                  </Link>
                ) : (
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${kpi.color}`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-lg font-bold tracking-tight">{kpi.value}</p>
                  </div>
                </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </FadeIn>

      {(data?.actionsByPerson?.length ?? 0) > 0 && (
        <FadeIn delay={0.1}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Open Action Items by Team Member</CardTitle>
                <Link href="/accountability" className="text-xs text-primary hover:underline flex items-center gap-1">Manage<ArrowRight className="h-3 w-3" /></Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {(data?.actionsByPerson ?? []).map((p: any, i: number) => (
                  <Link key={i} href={`/accountability?user=${p.id}`} className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg hover:bg-primary/10 hover:shadow-sm transition">
                    <span className="text-sm font-medium">{p.name}</span>
                    <Badge variant={p.count > 5 ? 'destructive' : 'secondary'}>{p.count}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />At-Risk Jobs by Margin</CardTitle>
                <Link href="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">View all<ArrowRight className="h-3 w-3" /></Link>
              </div>
            </CardHeader>
            <CardContent>
              {(data?.top5AtRisk?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No at-risk jobs</p>
              ) : (
                <Stagger className="space-y-2">
                  {(data?.top5AtRisk ?? []).map((job: any) => (
                    <StaggerItem key={job.id}>
                      <Link href={`/projects/${job.id}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div><p className="text-sm font-medium">{job.jobCode}</p><p className="text-xs text-muted-foreground truncate max-w-[200px]">{job.jobName}</p></div>
                        <div className="text-right">
                          <span className={`text-sm font-bold ${job.margin < 15 ? 'text-red-500' : 'text-amber-500'}`}>{formatPercent(job.margin)}</span>
                          <p className="text-xs text-muted-foreground">{job.pm}</p>
                        </div>
                      </Link>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.3}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Upcoming Milestones</CardTitle>
                <Link href="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">View all<ArrowRight className="h-3 w-3" /></Link>
              </div>
            </CardHeader>
            <CardContent>
              {(data?.upcomingMilestones?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No upcoming milestones</p>
              ) : (
                <Stagger className="space-y-2">
                  {(data?.upcomingMilestones ?? []).map((ms: any) => (
                    <StaggerItem key={ms.id}>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div><p className="text-sm font-medium">{ms.title}</p><p className="text-xs text-muted-foreground">{ms.jobCode} • {ms.phase}</p></div>
                        <Badge variant="outline" className="text-xs">{formatDate(ms.endDate)}</Badge>
                      </div>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn delay={0.4}>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4 text-primary" />Recent Imports</CardTitle></CardHeader>
          <CardContent>
            {(data?.recentImports?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No imports yet</p>
            ) : (
              <div className="space-y-2">
                {(data?.recentImports ?? []).map((imp: any) => (
                  <div key={imp.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div><p className="text-sm font-medium">{imp.fileName}</p><p className="text-xs text-muted-foreground">{imp.fileType} • {imp.recordsProcessed} records • by {imp.importedBy}</p></div>
                    <span className="text-xs text-muted-foreground">{formatDate(imp.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
