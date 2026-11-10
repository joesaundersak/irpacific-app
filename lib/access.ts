// Per-user section access. Role sets the defaults; User.permissions holds per-user overrides { [sectionKey]: boolean }.
export const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { key: 'pipeline', label: 'Sales Pipeline', href: '/pipeline' },
  { key: 'projects', label: 'Projects', href: '/projects' },
  { key: 'forecast', label: 'Revenue Forecast', href: '/forecast' },
  { key: 'ap', label: 'AP Calendar', href: '/ap-calendar' },
  { key: 'receivables', label: 'Receivables', href: '/receivables' },
  { key: 'meetings', label: 'Team Meetings', href: '/meetings' },
  { key: 'deleteMeetings', label: 'Delete meetings', href: '/meetings' },
  { key: 'accountability', label: 'Action Items', href: '/action-items' },
  { key: 'imports', label: 'Import Data', href: '/imports' },
  { key: 'settings', label: 'Settings (system config)', href: '/settings' },
  { key: 'users', label: 'Users & Access', href: '/settings' },
] as const

export type SectionKey = (typeof SECTIONS)[number]['key']
export type AccessMap = Record<SectionKey, boolean>

export function defaultAccess(roleName: string | null | undefined): AccessMap {
  const all = Object.fromEntries(SECTIONS.map(s => [s.key, true])) as AccessMap
  if (roleName === 'Admin') return all
  if (roleName === 'Office Manager') return { ...all, settings: false, users: false, deleteMeetings: false }
  return { ...all, imports: false, settings: false, users: false, deleteMeetings: false }
}

export function effectiveAccess(roleName: string | null | undefined, permissions: unknown): AccessMap {
  const base = defaultAccess(roleName)
  const overrides = permissions && typeof permissions === 'object' && !Array.isArray(permissions) ? (permissions as Record<string, unknown>) : {}
  for (const s of SECTIONS) {
    if (typeof overrides[s.key] === 'boolean') base[s.key] = overrides[s.key] as boolean
  }
  // An Admin always keeps Users & Access so nobody can lock the system out.
  if (roleName === 'Admin') base.users = true
  return base
}

export function firstAllowedHref(access: AccessMap): string {
  return SECTIONS.find(s => access[s.key])?.href ?? '/login'
}
