export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/access-server'
import { getSmtpConfig, SMTP_KEYS } from '@/lib/email'

async function guard() {
  const me = await getCurrentUser()
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (me.role !== 'Admin' && !me.access.settings) return { error: NextResponse.json({ error: 'You do not have access to settings' }, { status: 403 }) }
  return { me }
}

/** Current email settings. The password itself is never sent to the browser. */
export async function GET() {
  const { error } = await guard()
  if (error) return error
  const cfg = await getSmtpConfig()
  return NextResponse.json({
    host: cfg.host,
    port: String(cfg.port),
    user: cfg.user,
    from: cfg.from,
    passwordSet: Boolean(cfg.password),
    source: cfg.source,
  })
}

/** Saves email settings. A blank password keeps the saved one. */
export async function PUT(request: Request) {
  const { error } = await guard()
  if (error) return error
  try {
    const body = (await request.json().catch(() => ({}))) ?? {}
    const host = String(body.host ?? '').trim()
    const port = String(body.port ?? '').trim() || '587'
    const user = String(body.user ?? '').trim()
    const from = String(body.from ?? '').trim()
    const password = typeof body.password === 'string' ? body.password : ''
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!host) return NextResponse.json({ error: 'Enter the SMTP server' }, { status: 400 })
    if (!/^\d{1,5}$/.test(port)) return NextResponse.json({ error: 'Port must be a number' }, { status: 400 })
    if (!email.test(user)) return NextResponse.json({ error: 'Login must be an email address' }, { status: 400 })
    if (from && !email.test(from)) return NextResponse.json({ error: 'Sends-from must be an email address' }, { status: 400 })

    const values: Record<string, string> = { [SMTP_KEYS.host]: host, [SMTP_KEYS.port]: port, [SMTP_KEYS.user]: user, [SMTP_KEYS.from]: from || user }
    if (password) values[SMTP_KEYS.password] = password

    for (const [key, value] of Object.entries(values)) {
      await prisma.systemConfig.upsert({ where: { key }, update: { value }, create: { key, value } })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Saving email settings failed:', e)
    return NextResponse.json({ error: 'Failed to save email settings' }, { status: 500 })
  }
}
