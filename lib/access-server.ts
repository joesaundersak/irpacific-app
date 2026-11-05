import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { effectiveAccess, firstAllowedHref, type AccessMap, type SectionKey } from '@/lib/access'

export interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
  access: AccessMap
}

/** Loads the signed-in user with live role/permissions from the database. Returns null if signed out or deactivated. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null
  const user = await prisma.user.findUnique({ where: { id }, include: { role: true } })
  if (!user || user.isActive === false) return null
  return { id: user.id, name: user.name, email: user.email, role: user.role.name, access: effectiveAccess(user.role.name, user.permissions) }
}

/** For server pages: redirect to login when signed out, or to the first permitted section when access is denied. */
export async function ensureAccess(...keys: SectionKey[]): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (keys.length && !keys.some(k => user.access[k])) redirect(firstAllowedHref(user.access))
  return user
}
