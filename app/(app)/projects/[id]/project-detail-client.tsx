'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { DollarSign, Calendar, User, AlertTriangle, CheckCircle, Clock, ArrowLeft, Plus } from 'lucide-react'
import { formatCurrency, formatCurrencyFull, formatPercent, formatDate } from '@/lib/format'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { data: session } = useSession()

  const loadJob = () => {
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then(setJob)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadJob() }, [projectId])

  const updateMilestone = async (milestoneId: string, data: any) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId, ...data }),
      })
      if (res.ok) { toast.success('Milestone updated'); loadJob() }
      else toast.error('Failed to update')
    } catch { toast.error('Error') }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading project...</div>
  if (!job) return <div className="flex items-center justify-center py-20 text-muted-foreground">Project not found</div>

  const marginColor = job.marginHealth === 'green' ? 'text-green-600' : job.marginHealth === 'yellow' ? 'text-amber-600' : 'text-red-600'
  const costVariance = (job.projectedCosts ?? 0) - (job.actualCosts ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <PageHeader
          title={`${job.jobCode} — ${job.clientName ?? job.jobName}`}
          description={`${job.state ?? ''} • ${job.jobType ?? 'General'} • PM: ${job.projectManager?.name ?? 'Unassigned'}`}
        />
      </div>

      <Tabs defaultValue="financial" className="space-y-4">
        <TabsList>
          <TabsTrigger value="financial"><DollarSign className="h-3 w-3 mr-1" />Financial</TabsTrigger>
          <TabsTrigger value="schedule"><Calendar className="h-3 w-3 mr-1" />Schedule</TabsTrigger>
          <TabsTrigger value="contact"><User className="h-3 w-3 mr-1" />Contact</TabsTrigger>
        </TabsList>

        {/* Financial Tab */}
        <TabsContent value="financial">
          <FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Contract Summary</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Row label="Contract Price" value={formatCurrencyFull(job.contractPrice)} />
                  <Row label="Approved COs" value={formatCurrencyFull(job.approvedCOPrice)} />
                  <Row label="Revised Total" value={formatCurrencyFull(job.totalRevisedPrice)} bold />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Cost & Margin</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Row label="Projected Costs" value={formatCurrencyFull(job.projectedCosts)} />
                  <Row label="Actual Costs" value={formatCurrencyFull(job.actualCosts)} />
                  <Row label="% Complete" value={formatPercent(job.percentComplete)} />
                  <Row label="Projected Margin" value={formatPercent(job.projectedProfitPct)} className={marginColor} />
                  <Row label="Actual Margin" value={formatPercent(job.computedMargin)} className={marginColor} bold />
                  <Row label="Cost Variance" value={formatCurrencyFull(costVariance)} className={costVariance < 0 ? 'text-red-600' : 'text-green-600'} />
                  {job.computedMargin < (job.targetMargin ?? 25) && (
                    <div className="flex items-center gap-2 text-red-500 text-xs mt-2">
                      <AlertTriangle className="h-3 w-3" /> Below {job.targetMargin ?? 25}% target margin
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Billing & Payments</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Row label="Amount Invoiced" value={formatCurrencyFull(job.amountInvoiced)} />
                  <Row label="Payments Received" value={formatCurrencyFull(job.paymentsReceived)} />
                  <Row label="Client Balance (AR)" value={formatCurrencyFull(job.clientBalance)} bold />
                  <Row label="Costs Paid" value={formatCurrencyFull(job.costsPaid)} />
                  <Row label="Costs Outstanding (AP)" value={formatCurrencyFull(job.costsOutstanding)} />
                  <Row label="Earned Revenue" value={formatCurrencyFull(job.earnedRevenue)} />
                </CardContent>
              </Card>
            </div>
          </FadeIn>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <FadeIn>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Milestones & Schedule</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {(job.milestones?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No milestones yet. Import a Schedule export or add milestones manually.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phase</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Complete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(job.milestones ?? []).map((ms: any) => {
                        const isOverdue = ms.endDate && new Date(ms.endDate) < new Date() && !ms.isComplete
                        const isDueSoon = ms.endDate && !ms.isComplete && (
                          new Date(ms.endDate).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 &&
                          new Date(ms.endDate) >= new Date()
                        )
                        return (
                          <TableRow key={ms.id} className={isOverdue ? 'bg-red-50' : isDueSoon ? 'bg-amber-50' : ''}>
                            <TableCell><Badge variant="outline" className="text-xs">{ms.phase}</Badge></TableCell>
                            <TableCell className="text-sm">{ms.title}</TableCell>
                            <TableCell className="text-sm">{formatDate(ms.startDate)}</TableCell>
                            <TableCell className="text-sm">{formatDate(ms.endDate)}</TableCell>
                            <TableCell>
                              {ms.isComplete ? (
                                <Badge className="bg-green-100 text-green-700 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Done</Badge>
                              ) : isOverdue ? (
                                <Badge className="bg-red-100 text-red-700 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>
                              ) : isDueSoon ? (
                                <Badge className="bg-amber-100 text-amber-700 text-xs"><Clock className="h-3 w-3 mr-1" />Due Soon</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Pending</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={ms.isComplete}
                                onCheckedChange={(checked) => updateMilestone(ms.id, { isComplete: checked })}
                                disabled={session?.user?.role === 'PM' && job.projectManagerId !== session?.user?.id}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </FadeIn>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact">
          <FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Client Information</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Row label="Client" value={job.clientName ?? '—'} />
                  <Row label="Email" value={job.clientEmail ?? '—'} className={!job.clientEmail ? 'text-red-400' : ''} />
                  <Row label="Phone" value={job.clientPhone ?? '—'} className={!job.clientPhone ? 'text-red-400' : ''} />
                  {!job.clientEmail && !job.clientPhone && (
                    <div className="flex items-center gap-2 text-red-500 text-xs mt-2">
                      <AlertTriangle className="h-3 w-3" /> Missing contact information
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Jobsite Address</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Row label="Street" value={job.streetAddress ?? '—'} />
                  <Row label="City" value={job.city ?? '—'} />
                  <Row label="State" value={job.state ?? '—'} />
                  <Row label="ZIP" value={job.zip ?? '—'} />
                </CardContent>
              </Card>
            </div>
          </FadeIn>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? 'font-bold' : 'font-medium'} ${className ?? ''}`}>{value}</span>
    </div>
  )
}
