import nodemailer from 'nodemailer'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

export function createSmtpTransport() {
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    tls: { minVersion: 'TLSv1.2' },
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  })
}

function describeSmtpError(err: unknown): Error {
  const e = err as { code?: string; responseCode?: number; message?: string }
  if (e?.code === 'ETIMEDOUT' || e?.code === 'ECONNECTION' || e?.code === 'ESOCKET') {
    return new Error(
      `Could not reach ${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? '587'} (${e.code}). The hosting provider may be blocking outbound SMTP.`
    )
  }
  if (e?.code === 'EAUTH' || e?.responseCode === 535) {
    return new Error('Office 365 rejected the SMTP login. Check SMTP_USER/SMTP_PASSWORD and that Authenticated SMTP is enabled for the mailbox.')
  }
  return err instanceof Error ? err : new Error(String(err))
}

/**
 * Sends an email through the company Office 365 mailbox over SMTP (smtp.office365.com:587, STARTTLS).
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  let smtpError: Error | null = null

  if (smtpConfigured()) {
    try {
      await createSmtpTransport().sendMail({ from: `"IR Pacific Operations" <${from}>`, to, subject, html })
      return
    } catch (err) {
      smtpError = describeSmtpError(err)
      console.error(`SMTP send to ${to} failed:`, err)
    }
  }


  throw smtpError ?? new Error('Email is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASSWORD.')
}
