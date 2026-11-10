'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { APP_VERSION } from '@/lib/version'
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
  ClipboardCheck,
  Receipt,
  ShoppingCart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSidebarCollapsed } from '@/components/layouts/app-shell'
import type { AccessMap } from '@/lib/access'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, keys: ['dashboard'] },
  { href: '/pipeline', label: 'Sales Pipeline', icon: TrendingUp, keys: ['pipeline'] },
  { href: '/projects', label: 'Projects', icon: FolderKanban, keys: ['projects'] },
  { href: '/receivables', label: 'Invoices', icon: Receipt, keys: ['receivables'] },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, keys: ['purchaseOrders'] },
  { href: '/forecast', label: 'Revenue Forecast', icon: BarChart3, keys: ['forecast'] },
  { href: '/ap-calendar', label: 'AP Calendar', icon: Calendar, keys: ['ap'] },
  { href: '/meetings', label: 'Team Meetings', icon: Users, keys: ['meetings'] },
  { href: '/action-items', label: 'Action Items', icon: ClipboardCheck, keys: ['accountability'] },
  { href: '/imports', label: 'Import Data', icon: Upload, keys: ['imports'] },
  { href: '/settings', label: 'Settings', icon: Settings, keys: ['settings', 'users'] },
] as const

export function AppSidebar({ access }: { access: AccessMap }) {
  const pathname = usePathname()
  const { data: session } = useSession() || {}
  const userRole = session?.user?.role ?? ''
  const collapsed = useSidebarCollapsed()
  // Labels hide only on desktop when collapsed; the mobile drawer always shows them.
  const hideWhenCollapsed = collapsed ? 'lg:hidden' : ''

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn('mb-6 flex items-center gap-3 px-2', collapsed && 'lg:justify-center lg:px-0')}>
        <div className={cn('relative h-10 w-10 shrink-0', collapsed && 'lg:h-8 lg:w-8')}>
          <Image src="/IR-Logo-Symbol.png" alt="IR Pacific" fill className="object-contain" />
        </div>
        <div className={hideWhenCollapsed}>
          <p className="text-sm font-bold text-foreground">IR Pacific</p>
          <p className="text-[10px] text-muted-foreground">Operations</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems
          .filter((item) => item.keys.some((k) => access?.[k]))
          .map((item) => {
            const active = pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  collapsed && 'lg:justify-center lg:px-0',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className={cn('truncate', hideWhenCollapsed)}>{item.label}</span>
                {active && <ChevronRight className={cn('ml-auto h-3 w-3', hideWhenCollapsed)} />}
              </Link>
            )
          })}
      </nav>

      {/* User */}
      <div className="border-t pt-4 mt-4">
        <div className={cn('flex items-center gap-3 px-2 mb-3', collapsed && 'lg:justify-center lg:px-0')}>
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold"
            title={session?.user?.name ?? ''}
          >
            {session?.user?.name?.split(' ')?.map((n: string) => n?.[0])?.join('') ?? '?'}
          </div>
          <div className={cn('min-w-0', hideWhenCollapsed)}>
            <p className="text-sm font-medium truncate">{session?.user?.name ?? 'User'}</p>
            <p className="text-[10px] text-muted-foreground truncate">{userRole}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          title="Sign Out"
          className={cn('w-full justify-start text-muted-foreground', collapsed && 'lg:justify-center lg:px-0')}
          onClick={() => signOut({ redirectTo: '/login' })}
        >
          <LogOut className={cn('mr-2 h-4 w-4', collapsed && 'lg:mr-0')} />
          <span className={hideWhenCollapsed}>Sign Out</span>
        </Button>
        <p className={cn('mt-2 px-2 text-[10px] text-muted-foreground', hideWhenCollapsed)}>Version {APP_VERSION}</p>
      </div>
    </div>
  )
}
