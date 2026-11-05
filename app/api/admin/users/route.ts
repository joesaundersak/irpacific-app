export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/access-server'
import { SECTIONS, effectiveAccess } from '@/lib/access'

const HIDDEN = 'example.com'

async function requireUserAdmin() {
  const me = await getCurrentUser()
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!me.access.users) return { error: NextResponse.json({ error: 'You do not have access to manage users' }, { status: 403 }) }
  return { me }
}

/** Keeps only known section keys with boolean values; null means "use role defaults". */
function cleanPermissions(p: unknown): Record<string, boolean> | null {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const out: Record<string, boolean> = {}
  for (const s of SECTIONS) {
    const v = (p as Record<string, unknown>)[s.key]
    if (typeof v === 'boolean') out[s.key] = v
  }
  return Object.keys(out).length ? out : null
}

export async function GET() {
  try {
    const { error } = await requireUserAdmin()
    if (error) return error
    const [users, roles] = await Promise.all([
      prisma.user.findMany({
        where: { email: { not: { contains: HIDDEN } } },
        include: { role: true },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      prisma.role.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ])
    return NextResponse.json({
      roles,
      sections: SECTIONS,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roleId: u.roleId,
        roleName: u.role.name,
        isActive: u.isActive,
        permissions: u.permissions ?? null,
        access: effectiveAccess(u.role.name, u.permissions),
      })),
    })
  } catch (e) {
    console.error('Admin users GET error:', e)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requireUserAdmin()
    if (error) return error
    const { name, email, password, roleId, permissions } = (await request.json()) ?? {}
    const cleanEmail = String(email ?? '').trim().toLowerCase()
    if (!String(name ?? '').trim() || !cleanEmail || !roleId) return NextResponse.json({ error: 'Name, email and role are required' }, { status: 400 })
    if (!password || String(password).length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    if (await prisma.user.findUnique({ where: { email: cleanEmail } })) return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    const perms = cleanPermissions(permissions)
    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: cleanEmail,
        passwordHash: await bcrypt.hash(String(password), 10),
        roleId,
        isActive: true,
        ...(perms ? { permissions: perms } : {}),
      },
    })
    return NextResponse.json({ id: user.id })
  } catch (e) {
    console.error('Admin users POST error:', e)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { me, error } = await requireUserAdmin()
    if (error) return error
    const { id, name, email, password, roleId, isActive, permissions, resetPermissions } = (await request.json()) ?? {}
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.email.includes(HIDDEN)) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (id === me!.id && isActive === false) return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (name !== undefined) {
      if (!String(name).trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      data.name = String(name).trim()
    }
    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase()
      if (!cleanEmail) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      const clash = await prisma.user.findUnique({ where: { email: cleanEmail } })
      if (clash && clash.id !== id) return NextResponse.json({ error: 'Another user already has this email' }, { status: 409 })
      data.email = cleanEmail
    }
    if (password) {
      if (String(password).length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      data.passwordHash = await bcrypt.hash(String(password), 10)
    }
    if (roleId) {
      if (id === me!.id) {
        const role = await prisma.role.findUnique({ where: { id: roleId } })
        if (role?.name !== 'Admin' && me!.role === 'Admin') return NextResponse.json({ error: 'You cannot remove your own Admin role' }, { status: 400 })
      }
      data.roleId = roleId
    }
    if (typeof isActive === 'boolean') data.isActive = isActive
    if (resetPermissions) data.permissions = Prisma.DbNull
    else if (permissions !== undefined) data.permissions = cleanPermissions(permissions) ?? Prisma.DbNull

    await prisma.user.update({ where: { id }, data })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Admin users PUT error:', e)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { me, error } = await requireUserAdmin()
    if (error) return error
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    if (id === me!.id) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.email.includes(HIDDEN)) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Detach the user from everything so history is kept; open items become unassigned.
    await prisma.$transaction([
      prisma.actionItem.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
      prisma.actionItem.updateMany({ where: { createdById: id }, data: { createdById: null } }),
      prisma.meeting.updateMany({ where: { createdById: id }, data: { createdById: null } }),
      prisma.importHistory.updateMany({ where: { importedById: id }, data: { importedById: null } }),
      prisma.job.updateMany({ where: { projectManagerId: id }, data: { projectManagerId: null } }),
      prisma.lead.updateMany({ where: { salespersonId: id }, data: { salespersonId: null } }),
      prisma.user.delete({ where: { id } }),
    ])
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Admin users DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
