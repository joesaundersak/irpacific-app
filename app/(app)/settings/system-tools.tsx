'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Mail, Send, AlertTriangle, CheckCircle2, XCircle, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'

interface EmailStatus { host: string; port: string; user: string; from: string; passwordSet: boolean; source: 'settings' | 'environment' | 'none' }

export function EmailTestCard() {
  const [status, setStatus] = useState<EmailStatus | null>(null)
  const [form, setForm] = useState({ host: '', port: '587', user: '', from: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [to, setTo] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = () =>
    fetch('/api/settings/email').then(r => r.json()).then((s: EmailStatus) => {
      setStatus(s)
      setForm({ host: s.host || 'smtp.office365.com', port: s.port || '587', user: s.user || '', from: s.from || '', password: '' })
    }).catch(console.error)

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/email', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { toast.success('Email settings saved'); await load() }
      else toast.error(data.error ?? 'Failed to save email settings')
    } catch { toast.error('Failed to save email settings') } finally { setSaving(false) }
  }

  const send = async () => {
    setSending(true); setResult(null)
    try {
      const res = await fetch('/api/settings/test-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to }) })
      const data = await res.json().catch(() => ({}))
      if (data.ok) {
        setResult({ ok: true, message: `Test email sent to ${data.to}. Check the inbox (and junk folder).` })
        toast.success('Test email sent')
      } else {
        setResult({ ok: false, message: (data.stage === 'connect' ? 'Connection/login failed: ' : '') + (data.error ?? 'Failed to send') })
        toast.error('Test email failed')
      }
    } catch { setResult({ ok: false, message: 'Request failed' }) } finally { setSending(false) }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  const sourceLabel = status?.source === 'settings' ? 'Saved in the app' : status?.source === 'environment' ? 'From server environment variables' : 'Not configured'

  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />Email (Office 365)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {!status ? <p className="text-sm text-muted-foreground">Loading email settings…</p> : (<>
          <p className={`text-xs font-medium ${status.source === 'none' ? 'text-red-600' : 'text-green-700'}`}>Status: {sourceLabel}</p>
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <div className="space-y-1"><Label>SMTP server</Label><Input value={form.host} onChange={set('host')} placeholder="smtp.office365.com" /></div>
            <div className="space-y-1"><Label>Port</Label><Input value={form.port} onChange={set('port')} placeholder="587" inputMode="numeric" /></div>
          </div>
          <div className="space-y-1"><Label>Login (mailbox)</Label><Input type="email" value={form.user} onChange={set('user')} placeholder="info@irpnw.com" autoComplete="off" /></div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input type="password" value={form.password} onChange={set('password')} placeholder={status.passwordSet ? '•••••••• (saved — leave blank to keep)' : 'Mailbox password or app password'} autoComplete="new-password" />
          </div>
          <div className="space-y-1"><Label>Sends from</Label><Input type="email" value={form.from} onChange={set('from')} placeholder="Same as login" /></div>
          <p className="text-xs text-muted-foreground">Saved in the app database. The password is never shown again or sent to the browser. Values saved here take priority over server environment variables.</p>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? 'Saving…' : 'Save Email Settings'}</Button>
        </>)}
        <div className="space-y-1 border-t pt-4">
          <Label>Send test to</Label>
          <div className="flex gap-2">
            <Input type="email" placeholder="Leave blank to send to yourself" value={to} onChange={e => setTo(e.target.value)} />
            <Button onClick={send} disabled={sending}><Send className="h-4 w-4 mr-1" />{sending ? 'Sending…' : 'Send Test'}</Button>
          </div>
        </div>
        {result && (
          <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {result.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span className="break-words">{result.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ResetCard() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/settings/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: confirmText }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Reset failed'); return }
      const d = data.deleted ?? {}
      toast.success(`System reset: ${d.jobs ?? 0} projects, ${d.leads ?? 0} leads, ${d.meetings ?? 0} meetings and ${d.actionItems ?? 0} action items deleted`)
      setOpen(false); setConfirmText('')
      router.push('/imports')
    } catch { toast.error('Reset failed') } finally { setBusy(false) }
  }

  return (
    <Card className="max-w-xl border-red-200">
      <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700"><AlertTriangle className="h-4 w-4" />Danger Zone — Reset System</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Permanently deletes all imported BuilderTrend data (projects, leads, schedules, AP entries), every meeting and action item, and the import history. Users, access and settings are kept so you can re-import fresh exports.
        </p>
        <Button variant="destructive" onClick={() => setOpen(true)}><Trash2 className="h-4 w-4 mr-1" />Delete All Data &amp; Reset</Button>
      </CardContent>
      <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmText('') }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all data?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Type <strong>RESET</strong> to confirm.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="RESET" autoFocus />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={confirmText !== 'RESET' || busy} onClick={reset}>{busy ? 'Deleting…' : 'Delete Everything'}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
