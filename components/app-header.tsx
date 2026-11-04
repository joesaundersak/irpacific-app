'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export function AppHeader() {
  const { data: session } = useSession()
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    setDateStr(new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()))
  }, [])

  return (
    <div className="flex flex-1 items-center justify-between">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground">
          {dateStr}
        </span>
        <span className="text-sm font-medium">
          {session?.user?.name ?? ''}
        </span>
      </div>
    </div>
  )
}
