'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  TrendingUp,
  FolderKanban,
  BarChart3,
  Calendar,
  Users,
  Upload,
  LogOut,
  Settings,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pipeline', label: 'Sales Pipeline', icon: TrendingUp },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/forecast', label: 'Revenue Forecast', icon: BarChart3 },
  { href: '/ap-calendar', label: 'AP Calendar', icon: Calendar },
  { href: '/meetings', label: 'Team Meetings', icon: Users },
  { href: '/imports', label: 'Import Data', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userRole = session?.user?.role ?? ''
  const canUpload = userRole === 'Admin' || userRole === 'Office Manager'

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="relative h-10 w-10 shrink-0">
          <Image src="/IR-Logo-Symbol.png" alt="IR Pacific" fill className="object-contain" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">IR Pacific</p>
          <p className="text-[10px] text-muted-foreground">Operations</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems
          .filter((item) => {
            if (item.href === '/imports' && !canUpload) return false
            if (item.href === '/settings' && userRole !== 'Admin') return false
            return true
          })
          .map((item) => {
            const active = pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
                {active && <ChevronRight className="ml-auto h-3 w-3" />}
              </Link>
            )
          })}
      </nav>

      {/* User */}
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {session?.user?.name?.split(' ')?.map((n: string) => n?.[0])?.join('') ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{session?.user?.name ?? 'User'}</p>
            <p className="text-[10px] text-muted-foreground truncate">{userRole}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => signOut({ redirectTo: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
