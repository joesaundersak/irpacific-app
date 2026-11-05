export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

/** Full import history (newest first) for the Import Data page. */
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const rows = await prisma.importHistory.findMany({
      orderBy: { createdAt: 'desc' },
      include: { importedBy: { select: { name: true } } },
    })
    return NextResponse.json({
      imports: rows.map(i => ({
        id: i.id,
        fileName: i.fileName,
        fileType: i.fileType,
        recordsProcessed: i.recordsProcessed,
        recordsAdded: i.recordsAdded,
        recordsUpdated: i.recordsUpdated,
        recordsUnchanged: i.recordsUnchanged,
        status: i.status,
        importedBy: i.importedBy?.name ?? 'Unknown',
        createdAt: i.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('Import history failed:', err)
    return NextResponse.json({ error: 'Could not load import history' }, { status: 500 })
  }
}
