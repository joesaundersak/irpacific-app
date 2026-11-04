export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const users = await prisma.user.findMany({
      where: { email: { not: { contains: 'example.com' } } },
      select: { id: true, name: true, email: true, role: { select: { name: true } } },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Users error:', error)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}
