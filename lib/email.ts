import nodemailer from 'nodemailer'
import { prisma } from '@/lib/db'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
}

export interface SmtpConfig {
  host: string
  port: number
  user: string
  password: string
  from: string
  source: 'settings' | 'environment' | 'none'
}

/** SystemConfig keys holding the email settings. Never returned by the generic /api/settings endpoint. */
export const SMTP_KEYS = {
  host: 'smtp_host',
  port: 'smtp_port',
  user: 'smtp_user',
  password: 'smtp_password',
  from: 'smtp_from',
} as const
export const SMTP_KEY_LIST: string[] = Object.values(SMTP_KEYS)

/**
 * Email settings saved on the Settings page take priority; any value not saved there
 * falls back to the server environment (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM).
 */
export async function getSmtpConfig(): Promise<SmtpConfig> {
  let db: Record<string, string> = {}
  try {
    const rows = await prisma.systemConfig.findMany({ where: { key: { in: SMTP_KEY_LIST } } })
    db = Object.fromEntries(rows.map(r => [r.key, r.value]))
  } catch (err) {
    console.error('Could not load email settings from the database:', err)
  }
  // Ignore unfilled template placeholders such as CHANGE_ME or <password ...>
  const envVal = (v?: string) => (v && !/^(CHANGE_ME|<.*>)$/.test(v.trim()) ? v.trim() : '')
  const pick = (key: string, env?: string) => (db[key]?.trim() || envVal(env))
  const host = pick(SMTP_KEYS.host, process.env.SMTP_HOST)
  const user = pick(SMTP_KEYS.user, process.env.SMTP_USER)
  const password = db[SMTP_KEYS.password] || envVal(process.env.SMTP_PASSWORD)
  const port = parseInt(pick(SMTP_KEYS.port, process.env.SMTP_PORT) || '587', 10) || 587
  const from = pick(SMTP_KEYS.from, process.env.SMTP_FROM) || user
  const anyDb = SMTP_KEY_LIST.some(k => db[k])
  const source = !host || !user || !password ? 'none' : anyDb ? 'settings' : 'environment'
  return { host, port, user, password, from, source }
}

export function smtpReady(cfg: SmtpConfig): boolean {
  return Boolean(cfg.host && cfg.user && cfg.password)
}

export function createSmtpTransport(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    requireTLS: cfg.port !== 465,
    tls: { minVersion: 'TLSv1.2' },
    auth: { user: cfg.user, pass: cfg.password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  })
}

export function describeSmtpError(err: unknown, cfg: SmtpConfig): Error {
  const e = err as { code?: string; responseCode?: number; message?: string }
  if (e?.code === 'ETIMEDOUT' || e?.code === 'ECONNECTION' || e?.code === 'ESOCKET') {
    return new Error(
      `Could not reach ${cfg.host}:${cfg.port} (${e.code}). The hosting provider may be blocking outbound SMTP.`
    )
  }
  if (e?.code === 'EAUTH' || e?.responseCode === 535) {
    return new Error('Office 365 rejected the SMTP login. Check the login and password in Settings → Email, and that Authenticated SMTP is enabled for the mailbox.')
  }
  return err instanceof Error ? err : new Error(String(err))
}

/**
 * Sends an email through the company Office 365 mailbox over SMTP (smtp.office365.com:587, STARTTLS).
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const cfg = await getSmtpConfig()
  let smtpError: Error | null = null

  if (smtpReady(cfg)) {
    try {
      await createSmtpTransport(cfg).sendMail({ from: `"IR Pacific Operations" <${cfg.from}>`, to, subject, html })
      return
    } catch (err) {
      smtpError = describeSmtpError(err, cfg)
      console.error(`SMTP send to ${to} failed:`, err)
    }
  }


  throw smtpError ?? new Error('Email is not configured: enter the SMTP server, login and password in Settings → Email.')
}
