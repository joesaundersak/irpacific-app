export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    if (process.env.ALLOW_SIGNUP !== 'true') {
      return NextResponse.json({ error: 'Self sign-up is disabled. Ask the administrator for an account.' }, { status: 403 })
    }
    const body = await request.json()
    const { email, password, name } = body ?? {}
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }

    // Default role is PM
    let pmRole = await prisma.role.findUnique({ where: { name: 'PM' } })
    if (!pmRole) {
      pmRole = await prisma.role.create({ data: { name: 'PM', permissions: {} } })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        roleId: pmRole.id,
      },
    })

    return NextResponse.json({ id: user.id, email: user.email, name: user.name })
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
