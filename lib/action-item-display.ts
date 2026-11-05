/** Display helpers for action items: job/lead heading plus the individual actions as bullets. */

type ItemLike = {
  description?: string | null
  category?: string | null
  job?: { jobCode?: string | null; jobName?: string | null } | null
  lead?: { opportunityTitle?: string | null } | null
}

export function itemHeading(item: ItemLike): string | null {
  if (item.job?.jobCode || item.job?.jobName) return [item.job.jobCode, item.job.jobName].filter(Boolean).join(' - ')
  if (item.lead?.opportunityTitle) return `Lead: ${item.lead.opportunityTitle}`
  return null
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const splitList = (s: string) => s.split(/,\s*/).map(x => x.trim()).filter(Boolean)

export function itemBullets(item: ItemLike): string[] {
  const d = (item.description ?? '').trim()
  if (!d) return []

  if (item.category === 'missing_schedule') {
    const m = d.match(/(?:enter|add) dates for (.+)$/i)
    if (m) return splitList(m[1]).map(p => `Enter ${p} dates in BuilderTrend`)
  }
  if (item.category === 'missing_info') {
    const m = d.match(/: missing (.+)$/i)
    if (m) return splitList(m[1]).map(f => `Add ${f} in BuilderTrend`)
  }

  // Remove the job/lead name from the sentence, since it is shown as the heading
  let t = d
  const code = item.job?.jobCode ?? ''
  const name = item.job?.jobName ?? ''
  const label = code && name ? `${code} - ${name}` : ''
  if (label) {
    t = t.split(`${label}: `).join('')
    t = t.split(` for ${label}`).join('').split(` to ${label}`).join('').split(` on ${label}`).join('')
  }
  if (code) t = t.split(` on ${code}`).join('')
  const title = item.lead?.opportunityTitle
  if (title) {
    t = t.split(`Lead "${title}": `).join('')
    t = t.split(` to lead "${title}"`).join('')
    t = t.split(`on lead: ${title} `).join('on lead ')
    t = t.split(`lead "${title}" `).join('lead ')
    t = t.split(`: ${title}`).join('')
  }
  return [cap(t.trim())]
}
