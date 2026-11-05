export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/access-server'
import { getSmtpConfig, smtpReady, diagnoseSmtp, sendEmail, createSmtpTransport, describeSmtpError, type SmtpStep } from '@/lib/email'

/** Checks connect → encryption → login step by step with the saved settings, then sends a test message to `to`. */
export async function POST(request: Request) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (me.role !== 'Admin' && !me.access.settings) return NextResponse.json({ error: 'You do not have access to settings' }, { status: 403 })

  const { to } = (await request.json().catch(() => ({}))) ?? {}
  const recipient = String(to || me.email).trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return NextResponse.json({ ok: false, error: 'Enter a valid email address' }, { status: 400 })

  const cfg = await getSmtpConfig()
  let steps: (SmtpStep | { key: 'send'; label: string; ok: boolean | null; detail: string })[] = []
  if (smtpReady(cfg)) {
    const diag = await diagnoseSmtp(cfg)
    steps = [...diag.steps, { key: 'send', label: `Send test to ${recipient}`, ok: null, detail: '' }]
    if (!diag.ok) {
      console.error('SMTP test failed:', diag.error)
      return NextResponse.json({ ok: false, stage: 'connect', error: diag.error, steps })
    }
  }
  const sendStep = steps[steps.length - 1]

  try {
    const sentAt = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    const subject = 'IR Pacific Operations — test email'
    const html = `<div style="font-family:Roboto,Arial,sans-serif;color:#3A3A3A"><h2 style="color:#1A7B84">Email is working</h2><p>This test message was sent from IR Pacific Operations by ${me.name} on ${sentAt} (Pacific).</p><p>Meeting summaries will be delivered the same way.</p></div>`
    if (smtpReady(cfg)) {
      // Test the Office 365 mailbox itself, with no fallback, so the result is always honest
      try {
        await createSmtpTransport(cfg).sendMail({ from: `"IR Pacific Operations" <${cfg.from}>`, to: recipient, subject, html })
      } catch (err) {
        console.error('SMTP test send failed:', err)
        throw describeSmtpError(err, cfg)
      }
    } else {
      await sendEmail({ to: recipient, subject, html })
    }
    if (sendStep) sendStep.ok = true
    return NextResponse.json({ ok: true, to: recipient, via: smtpReady(cfg) ? 'smtp' : 'fallback', steps })
  } catch (e) {
    if (sendStep) sendStep.ok = false
    return NextResponse.json({ ok: false, stage: 'send', error: e instanceof Error ? e.message : String(e), steps })
  }
}
