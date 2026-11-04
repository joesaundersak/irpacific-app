'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Save } from 'lucide-react'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'

export function SettingsClient() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure system-wide parameters" />
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
    </div>
  )
}
