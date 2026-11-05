/* Progress-billing forecast: bills each phase's share of the contract across that phase's dates. */
import { INSTALL_PHASES, FORECAST_CONFIG_KEYS, ScheduleEval } from './schedule-rules'

export interface ForecastModel { phases: { key: string; label: string; bill: number; time: number }[]; productDeposit: number }

export function loadModel(config: Record<string, string>): ForecastModel {
  const num = (v: string | undefined, d: number) => { const n = parseFloat(v ?? ''); return isFinite(n) && n >= 0 ? n : d }
  const phases = INSTALL_PHASES.map(p => ({
    key: p.key, label: p.label,
    bill: num(config[FORECAST_CONFIG_KEYS.bill(p.key)], p.bill),
    time: num(config[FORECAST_CONFIG_KEYS.time(p.key)], p.time),
  }))
  const bSum = phases.reduce((s, p) => s + p.bill, 0) || 1
  const tSum = phases.reduce((s, p) => s + p.time, 0) || 1
  phases.forEach(p => { p.bill = p.bill / bSum; p.time = p.time / tSum })
  return { phases, productDeposit: Math.min(1, num(config[FORECAST_CONFIG_KEYS.productDeposit], 50) / 100) }
}

const DAY = 86400000
export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

/** Typical duration when a project/lead has no end date, by size. */
export function defaultDurationDays(value: number): number {
  if (value < 25000) return 30
  if (value < 100000) return 60
  if (value < 250000) return 120
  if (value < 500000) return 180
  return 270
}

export class MonthBuckets {
  months: string[]
  values: number[]
  beyond = 0
  private start: Date
  constructor(start: Date, count: number) {
    this.start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
    this.months = Array.from({ length: count }, (_, i) => monthKey(new Date(Date.UTC(this.start.getUTCFullYear(), this.start.getUTCMonth() + i, 1))))
    this.values = new Array(count).fill(0)
  }
  private addAt(d: Date, amt: number) {
    const idx = this.months.indexOf(monthKey(d < this.start ? this.start : d))
    if (idx >= 0) this.values[idx] += amt
    else this.beyond += amt
  }
  /** Bill a lump sum in the month of `d` (past dates roll into the current month). */
  point(d: Date, amt: number) { if (amt > 0) this.addAt(d, amt) }
  /** Spread an amount evenly by day between start and end (past portion rolls into the current month). */
  spread(s: Date, e: Date, amt: number) {
    if (amt <= 0) return
    if (e <= s) return this.point(e, amt)
    const total = e.getTime() - s.getTime()
    let cur = s
    while (cur < e) {
      const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1))
      const segEnd = next < e ? next : e
      this.addAt(cur, amt * (segEnd.getTime() - cur.getTime()) / total)
      cur = segEnd
    }
  }
}

interface InstallInput {
  contract: number
  billed: number // invoiced to date, or earned (% complete) if higher
  start: Date
  end: Date
  schedule?: ScheduleEval | null // actual phase dates override the default timeline
}

/** Install project: phase shares billed progressively; completion/retainage billed at the end of completion. */
export function forecastInstall(b: MonthBuckets, model: ForecastModel, inp: InstallInput) {
  const { contract } = inp
  if (contract <= 0) return
  const span = Math.max(inp.end.getTime() - inp.start.getTime(), 7 * DAY)
  let tCursor = inp.start.getTime()
  let cum = 0
  for (const p of model.phases) {
    const defStart = new Date(tCursor)
    tCursor += span * p.time
    const defEnd = new Date(tCursor)
    const actual = inp.schedule?.phases.find(x => x.key === p.key && x.count > 0)
    const s = actual?.start ?? defStart
    const e = actual?.end ?? defEnd
    const phaseStart = cum, phaseEnd = cum + contract * p.bill
    cum = phaseEnd
    const remaining = Math.max(0, phaseEnd - Math.max(inp.billed, phaseStart))
    if (remaining <= 0) continue
    if (p.key === 'completion') b.point(e, remaining)
    else b.spread(s, new Date(e.getTime() + DAY), remaining)
  }
}

/** Product sale: deposit at PO date, balance at customer delivery. */
export function forecastProduct(b: MonthBuckets, model: ForecastModel, inp: { contract: number; billed: number; po: Date; delivery: Date }) {
  const deposit = inp.contract * model.productDeposit
  b.point(inp.po, Math.max(0, deposit - inp.billed))
  b.point(inp.delivery, Math.max(0, inp.contract - Math.max(inp.billed, deposit)))
}
