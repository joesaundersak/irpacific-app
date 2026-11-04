import nodemailer from 'nodemailer'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
}

/**
 * Sends an email. Order of transports:
 * 1. Resend HTTPS API when RESEND_API_KEY is set (works on DigitalOcean, which blocks SMTP ports).
 * 2. SMTP (e.g. Office 365) when SMTP_HOST/SMTP_USER/SMTP_PASSWORD are set.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey && resendKey !== 'CHANGE_ME') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from: `IR Pacific Operations <${from}>`, to: [to], subject, html }),
    })
    if (!res.ok) throw new Error(`Resend returned ${res.status}: ${await res.text()}`)
    return
  }

  const smtpHost = process.env.SMTP_HOST
  let smtpError: unknown = null

  if (smtpHost && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    try {
      const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      })
      await transporter.sendMail({
        from: `"IR Pacific Operations" <${from}>`,
        to,
        subject,
        html,
      })
      return
    } catch (err) {
      smtpError = err
      console.error(`SMTP send to ${to} failed:`, err)
    }
  }


  throw smtpError ?? new Error('No email transport configured (set RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASSWORD)')
}
