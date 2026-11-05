'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Save, LineChart } from 'lucide-react'
import { INSTALL_PHASES, FORECAST_CONFIG_KEYS } from '@/lib/schedule-rules'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'
import { UsersManager } from './users-manager'
import { EmailTestCard, ResetCard } from './system-tools'

interface Props { canConfig: boolean; canUsers: boolean; isAdmin: boolean; currentUserId: string }

export function SettingsClient({ canConfig, canUsers, isAdmin, currentUserId }: Props) {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(canConfig)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!canConfig) return
    fetch('/api/settings')
      .then(r => r.json())
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [canConfig])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) toast.success('Settings saved')
      else toast.error('Failed to save')
    } catch { toast.error('Error saving settings') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading settings...</div>

  const val = (key: string, def: number) => config?.[key] ?? String(def)
  const sum = (kind: 'bill' | 'time') => INSTALL_PHASES.reduce((s, p) => s + (parseFloat(val(FORECAST_CONFIG_KEYS[kind](p.key), p[kind])) || 0), 0)
  const setKey = (key: string, v: string) => setConfig(c => ({ ...c, [key]: v }))

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Users, access and system-wide parameters" />
      {canUsers && <FadeIn><UsersManager currentUserId={currentUserId} /></FadeIn>}
      {canConfig && (<>
      <FadeIn>
        <Card className="max-w-xl">
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Settings className="h-4 w-4 text-primary" />System Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Margin (%)</Label>
              <Input
                type="number"
                value={config?.target_margin ?? '25'}
                onChange={e => setConfig(c => ({ ...c, target_margin: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Jobs below this margin will be flagged as at-risk</p>
            </div>
            <div className="space-y-2">
              <Label>Stale Lead Days</Label>
              <Input
                type="number"
                value={config?.stale_lead_days ?? '30'}
                onChange={e => setConfig(c => ({ ...c, stale_lead_days: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Leads with no activity beyond this many days will be flagged as stale</p>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
      <FadeIn>
        <Card className="max-w-xl">
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><LineChart className="h-4 w-4 text-primary" />Forecast Billing Model</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Install projects bill progressively by phase. &quot;% of Contract&quot; is how much is billed in each phase; &quot;% of Timeline&quot; is the default share of the project duration used when a phase has no dates on the schedule. Totals are normalized to 100%.
            </p>
            <div className="grid grid-cols-[1fr_90px_90px] gap-2 items-center text-sm">
              <span className="text-xs font-medium text-muted-foreground">Phase</span>
              <span className="text-xs font-medium text-muted-foreground">% of Contract</span>
              <span className="text-xs font-medium text-muted-foreground">% of Timeline</span>
              {INSTALL_PHASES.map(p => (
                <div key={p.key} className="contents">
                  <span>{p.label}</span>
                  <Input type="number" value={val(FORECAST_CONFIG_KEYS.bill(p.key), p.bill)} onChange={e => setKey(FORECAST_CONFIG_KEYS.bill(p.key), e.target.value)} />
                  <Input type="number" value={val(FORECAST_CONFIG_KEYS.time(p.key), p.time)} onChange={e => setKey(FORECAST_CONFIG_KEYS.time(p.key), e.target.value)} />
                </div>
              ))}
              <span className="text-xs font-medium">Total</span>
              <span className={`text-xs font-medium ${sum('bill') === 100 ? 'text-green-600' : 'text-amber-600'}`}>{sum('bill')}%</span>
              <span className={`text-xs font-medium ${sum('time') === 100 ? 'text-green-600' : 'text-amber-600'}`}>{sum('time')}%</span>
            </div>
            <div className="space-y-2">
              <Label>Product Sale Deposit at PO (%)</Label>
              <Input type="number" value={val(FORECAST_CONFIG_KEYS.productDeposit, 50)} onChange={e => setKey(FORECAST_CONFIG_KEYS.productDeposit, e.target.value)} />
              <p className="text-xs text-muted-foreground">Billed on the PO due date; the balance is billed on the customer delivery date</p>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
      <FadeIn><EmailTestCard /></FadeIn>
      </>)}
      {isAdmin && <FadeIn><ResetCard /></FadeIn>}
    </div>
  )
}
