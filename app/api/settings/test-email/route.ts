export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/access-server'
import { smtpConfigured, createSmtpTransport, describeSmtpError, sendEmail } from '@/lib/email'

async function guard() {
  const me = await getCurrentUser()
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (me.role !== 'Admin' && !me.access.settings) return { error: NextResponse.json({ error: 'You do not have access to settings' }, { status: 403 }) }
  return { me }
}

/** Current email configuration (no secrets). */
export async function GET() {
  const { error } = await guard()
  if (error) return error
  return NextResponse.json({
    configured: smtpConfigured(),
    host: process.env.SMTP_HOST ?? '',
    port: process.env.SMTP_PORT ?? '587',
    user: process.env.SMTP_USER ?? '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    passwordSet: Boolean(process.env.SMTP_PASSWORD),
  })
}

/** Verifies the SMTP connection/login, then sends a test message to `to`. */
export async function POST(request: Request) {
  const { me, error } = await guard()
  if (error) return error
  const { to } = (await request.json().catch(() => ({}))) ?? {}
  const recipient = String(to || me!.email).trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return NextResponse.json({ ok: false, error: 'Enter a valid email address' }, { status: 400 })

  if (smtpConfigured()) {
    try {
      await createSmtpTransport().verify()
    } catch (e) {
      return NextResponse.json({ ok: false, stage: 'connect', error: describeSmtpError(e).message })
    }
  }

  try {
    const sentAt = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    await sendEmail({
      to: recipient,
      subject: 'IR Pacific Operations — test email',
      html: `<div style="font-family:Roboto,Arial,sans-serif;color:#3A3A3A"><h2 style="color:#1A7B84">Email is working</h2><p>This test message was sent from IR Pacific Operations by ${me!.name} on ${sentAt} (Pacific).</p><p>Meeting summaries will be delivered the same way.</p></div>`,
    })
    return NextResponse.json({ ok: true, to: recipient, via: smtpConfigured() ? 'smtp' : 'fallback' })
  } catch (e) {
    return NextResponse.json({ ok: false, stage: 'send', error: e instanceof Error ? e.message : String(e) })
  }
}
