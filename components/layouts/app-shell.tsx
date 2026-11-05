'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { PanelLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'irp_sidebar_collapsed'
const SidebarCollapsedContext = createContext(false)

/** True when the desktop sidebar is collapsed to icons only (mobile drawer is always expanded). */
export function useSidebarCollapsed() {
  return useContext(SidebarCollapsedContext)
}

export function AppShell({
  sidebar,
  header,
  children,
  className,
}: {
  sidebar: React.ReactNode
  header?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === '1') } catch { /* storage unavailable */ }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(STORAGE_KEY, c ? '0' : '1') } catch { /* storage unavailable */ }
      return !c
    })
  }

  return (
    <SidebarCollapsedContext.Provider value={collapsed && !sidebarOpen}>
      <div className="min-h-screen bg-background">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-64 border-r bg-card transition-all duration-normal ease-out lg:translate-x-0',
            collapsed && !sidebarOpen && 'lg:w-16',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className={cn('flex h-full flex-col overflow-y-auto overflow-x-hidden p-4', collapsed && !sidebarOpen && 'lg:px-2')}>
            {sidebar}
          </div>
        </aside>

        {/* Main area */}
        <div className={cn('transition-all duration-normal', collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-md px-4 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              title={collapsed ? 'Expand menu' : 'Collapse menu'}
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
            {header}
          </header>

          {/* Content */}
          <main className={cn('p-4 sm:p-6 lg:p-8', className)}>
            {children}
          </main>
        </div>
      </div>
    </SidebarCollapsedContext.Provider>
  )
}
