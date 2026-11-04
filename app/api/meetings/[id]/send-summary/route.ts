export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        actionItems: {
          include: { assignedTo: { select: { name: true } } },
          orderBy: { priority: 'asc' },
        },
      },
    })

    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

    // Build email HTML
    const meetingDateStr = meeting.meetingDate
      ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(meeting.meetingDate)
      : 'Unknown Date'

    const actionItemRows = (meeting.actionItems ?? []).map((item: any) =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.description}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.assignedTo?.name ?? 'Unassigned'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.status}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.priority}</td>
      </tr>`
    ).join('')

    const htmlBody = `
      <div style="font-family:Roboto,Arial,sans-serif;max-width:700px;margin:0 auto;">
        <div style="background:#1A7B84;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:20px;">Meeting Summary</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">${meeting.title} — ${meetingDateStr}</p>
        </div>
        <div style="background:white;padding:24px;border:1px solid #eee;border-top:0;">
          ${meeting.notes ? `<div style="background:#f5f5f5;padding:16px;border-radius:6px;margin-bottom:20px;"><h3 style="margin:0 0 8px;color:#3A3A3A;">Notes</h3><p style="margin:0;color:#555;white-space:pre-wrap;">${meeting.notes}</p></div>` : ''}
          <h3 style="color:#3A3A3A;margin:0 0 12px;">Action Items (${meeting.actionItems?.length ?? 0})</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f5f5f5;">
              <th style="padding:8px;text-align:left;">Description</th>
              <th style="padding:8px;text-align:left;">Assigned</th>
              <th style="padding:8px;text-align:left;">Status</th>
              <th style="padding:8px;text-align:left;">Priority</th>
            </tr></thead>
            <tbody>${actionItemRows || '<tr><td colspan="4" style="padding:8px;text-align:center;color:#999;">No action items</td></tr>'}</tbody>
          </table>
        </div>
        <div style="background:#f5f5f5;padding:12px 24px;border-radius:0 0 8px 8px;border:1px solid #eee;border-top:0;">
          <p style="margin:0;font-size:11px;color:#999;">IR Pacific Operations — Auto-generated meeting summary</p>
        </div>
      </div>
    `

    // Send to all team members
    const users = await prisma.user.findMany({ select: { email: true, name: true } })
    let sent = 0
    const failed: string[] = []

    for (const user of users) {
      // Skip system test account
      if (!user.email || user.email.includes('example.com')) continue
      try {
        await sendEmail({
          to: user.email,
          subject: `Meeting Summary: ${meeting.title} — ${meetingDateStr}`,
          html: htmlBody,
        })
        sent++
      } catch (emailErr: any) {
        console.error(`Failed to send to ${user.email}:`, emailErr)
        failed.push(user.email)
      }
    }

    if (sent === 0) {
      return NextResponse.json({ error: 'Summary email could not be sent. Check the SMTP settings.', failed }, { status: 502 })
    }

    await prisma.meeting.update({ where: { id }, data: { summarySent: true } })

    return NextResponse.json({ success: true, sent, failed })
  } catch (error: any) {
    console.error('Send summary error:', error)
    return NextResponse.json({ error: 'Failed to send summary' }, { status: 500 })
  }
}
