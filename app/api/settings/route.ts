export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/access-server'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const configs = await prisma.systemConfig.findMany()
    const map: Record<string, string> = {}
    configs.forEach((c: any) => { map[c.key] = c.value })

    return NextResponse.json(map)
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const me = await getCurrentUser()
    if (!me || (me.role !== 'Admin' && !me.access.settings)) return NextResponse.json({ error: 'You do not have access to change settings' }, { status: 403 })

    const body = await request.json()
    const entries = Object.entries(body ?? {})

    for (const [key, value] of entries) {
      await prisma.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
