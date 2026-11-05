import nodemailer from 'nodemailer'
import SMTPConnection from 'nodemailer/lib/smtp-connection'
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
  const password = (db[SMTP_KEYS.password] || envVal(process.env.SMTP_PASSWORD)).trim()
  const port = parseInt(pick(SMTP_KEYS.port, process.env.SMTP_PORT) || '587', 10) || 587
  const from = pick(SMTP_KEYS.from, process.env.SMTP_FROM) || user
  const anyDb = SMTP_KEY_LIST.some(k => db[k])
  const source = !host || !user || !password ? 'none' : anyDb ? 'settings' : 'environment'
  return { host, port, user, password, from, source }
}

export function smtpReady(cfg: SmtpConfig): boolean {
  return Boolean(cfg.host && cfg.user && cfg.password)
}

/** Office 365 standard: port 587 with STARTTLS (TLS 1.2+). Port 465 uses implicit TLS. */
function connectionOptions(cfg: SmtpConfig) {
  return {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    requireTLS: cfg.port !== 465,
    tls: { minVersion: 'TLSv1.2' as const, servername: cfg.host },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  }
}

export function encryptionLabel(port: number): string {
  return port === 465 ? 'SSL/TLS (implicit)' : 'STARTTLS (TLS 1.2 or newer, required)'
}

export function createSmtpTransport(cfg: SmtpConfig) {
  return nodemailer.createTransport({ ...connectionOptions(cfg), auth: { user: cfg.user, pass: cfg.password } })
}

type SmtpErr = { code?: string; responseCode?: number; response?: string; command?: string; message?: string }

/** Plain-English guidance for Microsoft's SMTP login rejection codes. */
function loginAdvice(response: string, user: string): string {
  if (/5\.7\.139/.test(response)) {
    return 'Microsoft is blocking basic SMTP login for this tenant. Usually Security Defaults (Entra ID → Overview → Properties) or a Conditional Access policy that blocks legacy authentication. Turn Security Defaults off or exclude this mailbox from the policy.'
  }
  if (/SmtpClientAuthentication is disabled|5\.7\.3\b.*disabled/i.test(response)) {
    return `SMTP AUTH is disabled. In Exchange PowerShell run: Set-TransportConfig -SmtpClientAuthenticationDisabled $false and Set-CASMailbox ${user} -SmtpClientAuthenticationDisabled $false`
  }
  return `Microsoft says the login or password is wrong, or SMTP AUTH is off for the organization. Check: (1) the app password was created while signed in as ${user}, (2) that account has MFA turned on (app passwords only work with MFA; without MFA use the normal password), (3) the organization-wide setting is on: Set-TransportConfig -SmtpClientAuthenticationDisabled $false, (4) Security Defaults are off.`
}

export function describeSmtpError(err: unknown, cfg: SmtpConfig): Error {
  const e = (err ?? {}) as SmtpErr
  const raw = (e.response || '').trim()
  const ms = raw ? ` Microsoft replied: "${raw}"` : ''
  if (e.code === 'ETLS') {
    return new Error(`The server was reached but the encrypted (TLS) connection failed.${ms}`)
  }
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION' || e.code === 'ESOCKET' || e.code === 'EDNS') {
    return new Error(`Could not reach ${cfg.host}:${cfg.port} (${e.code}). The hosting provider may be blocking outbound SMTP.${ms}`)
  }
  if (e.code === 'EAUTH' || e.responseCode === 535) {
    return new Error(`Office 365 rejected the login for ${cfg.user}.${ms} ${loginAdvice(raw, cfg.user)}`)
  }
  if (e.command === 'RCPT TO') {
    return new Error(`Login worked, but Microsoft rejected the recipient address.${ms}`)
  }
  if (e.command === 'MAIL FROM' || /5\.7\.(57|60)|SendAsDenied/i.test(raw)) {
    return new Error(`Login worked, but Microsoft refused to send as ${cfg.from}.${ms} The "Sends from" address must be the login mailbox, or the login needs Send As permission on it.`)
  }
  const base = err instanceof Error ? err.message : String(err)
  return new Error(raw && !base.includes(raw) ? `${base}.${ms}` : base)
}

export interface SmtpStep { key: 'connect' | 'encryption' | 'login'; label: string; ok: boolean | null; detail: string }
export interface SmtpDiagnosis { ok: boolean; steps: SmtpStep[]; error?: string }

/**
 * Runs the SMTP handshake one step at a time (connect → STARTTLS → login) and reports
 * which step passed or failed, including the TLS version and Microsoft's exact reply.
 */
export async function diagnoseSmtp(cfg: SmtpConfig): Promise<SmtpDiagnosis> {
  const steps: SmtpStep[] = [
    { key: 'connect', label: `Server reached (${cfg.host}:${cfg.port})`, ok: null, detail: '' },
    { key: 'encryption', label: `Encryption: ${encryptionLabel(cfg.port)}`, ok: null, detail: '' },
    { key: 'login', label: `Login as ${cfg.user}`, ok: null, detail: '' },
  ]
  const [connect, encryption, login] = steps
  const conn = new SMTPConnection(connectionOptions(cfg))
  const internals = conn as unknown as { _socket?: { getProtocol?: () => string | null }; _supportedAuth?: string[]; secure?: boolean }
  conn.on('error', () => { /* reported through the callbacks below */ })
  const close = () => { try { conn.close() } catch { /* already closed */ } }

  try {
    await new Promise<void>((resolve, reject) => conn.connect(err => (err ? reject(err) : resolve())))
  } catch (err) {
    const e = (err ?? {}) as SmtpErr
    const reached = e.code === 'ETLS' || e.command === 'STARTTLS' || e.command === 'EHLO'
    connect.ok = reached
    if (reached) encryption.ok = false
    close()
    return { ok: false, steps, error: describeSmtpError(err, cfg).message }
  }

  connect.ok = true
  const protocol = internals._socket?.getProtocol?.() || ''
  encryption.ok = Boolean(internals.secure || protocol)
  encryption.detail = protocol ? `Connected with ${protocol}` : ''
  const methods = internals._supportedAuth ?? []
  if (methods.length) login.detail = `Server offers: ${methods.join(', ')}`

  try {
    await new Promise<void>((resolve, reject) =>
      conn.login({ user: cfg.user, pass: cfg.password }, err => (err ? reject(err) : resolve()))
    )
    login.ok = true
    try { conn.quit() } catch { /* ignore */ }
    return { ok: true, steps }
  } catch (err) {
    login.ok = false
    const raw = ((err as SmtpErr)?.response || '').trim()
    if (raw) login.detail = `Microsoft replied: ${raw}`
    close()
    return { ok: false, steps, error: describeSmtpError(err, cfg).message }
  }
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
