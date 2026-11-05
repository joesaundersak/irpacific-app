'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Mail, Send, AlertTriangle, CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface EmailStatus { configured: boolean; host: string; port: string; user: string; from: string; passwordSet: boolean }

export function EmailTestCard() {
  const [status, setStatus] = useState<EmailStatus | null>(null)
  const [to, setTo] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/test-email').then(r => r.json()).then(setStatus).catch(console.error)
  }, [])

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

  const row = (label: string, value: string, ok: boolean) => (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`truncate font-medium ${ok ? '' : 'text-red-600'}`}>{value || 'Not set'}</span>
    </div>
  )

  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />Email Settings Test</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {status ? (
          <div className="space-y-1.5 rounded-lg bg-muted p-3">
            {row('SMTP server', status.host ? `${status.host}:${status.port}` : '', !!status.host)}
            {row('Login', status.user, !!status.user)}
            {row('Password', status.passwordSet ? 'Set' : '', status.passwordSet)}
            {row('Sends from', status.from, !!status.from)}
          </div>
        ) : <p className="text-sm text-muted-foreground">Loading email settings…</p>}
        <p className="text-xs text-muted-foreground">These values come from the server environment (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM). The test logs in to the mail server, then sends a message.</p>
        <div className="space-y-1">
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
