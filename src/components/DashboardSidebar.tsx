'use client'

/**
 * Shared sidebar component for all /dashboard/* pages.
 * Uses usePathname() for active-state detection — no prop needed.
 * Active route gets violet highlight; inactive gets muted blue.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pen, Plus, FileText, Zap, Sparkles, BookOpen } from 'lucide-react'
import { track } from '@/lib/analytics/client'
import { getUsage } from '@/lib/usage/storage'

interface DashboardSidebarProps {
  postsUsed?: number
  postsLimit?: number
  allTime?: number
}

const NAV_ITEMS = [
  { href: '/dashboard',          label: 'Dashboard',  icon: Zap,       exact: true  },
  { href: '/dashboard/generate', label: 'New Post',   icon: Plus,      exact: false },
  { href: '/dashboard/history',  label: 'History',    icon: FileText,  exact: false },
  { href: '/dashboard/notes',    label: 'Notes',      icon: BookOpen,  exact: false },
  { href: '/dashboard/style',    label: 'My Style',   icon: Sparkles,  exact: false },
]

export default function DashboardSidebar({
  postsUsed: propUsed,
  postsLimit: propLimit,
}: DashboardSidebarProps) {
  const pathname = usePathname()

  // Fall back to localStorage when parent doesn't pass usage data
  const [postsUsed, setPostsUsed]   = useState(propUsed  ?? 0)
  const [postsLimit, setPostsLimit] = useState(propLimit ?? 3)

  useEffect(() => {
    if (propUsed !== undefined) return   // parent already gave us real data
    try {
      const u = getUsage()
      setPostsUsed(u.monthCount)
      setPostsLimit(u.limit)
    } catch { /* ok */ }
  }, [propUsed])

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const usagePercent = Math.min((postsUsed / postsLimit) * 100, 100)

  return (
    <div
      className="fixed left-0 top-0 bottom-0 w-64 p-6 flex flex-col"
      style={{ backgroundColor: '#030812', borderRight: '1px solid rgba(26,58,110,0.5)' }}
    >
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-2 font-bold text-lg mb-8"
        style={{ color: '#e0e9ff' }}
      >
        <div className="w-7 h-7 rounded-lg gradient-bg-electric flex items-center justify-center">
          <Pen className="w-3.5 h-3.5 text-white" />
        </div>
        Drafture
      </Link>

      {/* Nav */}
      <nav className="space-y-1 flex-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors hover:bg-white/5"
              style={
                active
                  ? {
                      backgroundColor: 'rgba(124,58,237,0.2)',
                      color: '#b8a4ff',
                      border: '1px solid rgba(124,58,237,0.3)',
                      fontWeight: 600,
                    }
                  : { color: '#5a7dc4' }
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {(href === '/dashboard/style' || href === '/dashboard/notes') && !active && (
                <span
                  className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(124,58,237,0.25)', color: '#9775fa' }}
                >
                  NEW
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Usage meter */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: 'rgba(12,28,61,0.8)', border: '1px solid rgba(26,58,110,0.5)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: '#94afee' }}>
            Monthly posts
          </span>
          <span className="text-sm" style={{ color: '#5a7dc4' }}>
            {postsUsed}/{postsLimit}
          </span>
        </div>
        <div
          className="w-full rounded-full h-2 mb-3"
          style={{ backgroundColor: 'rgba(26,58,110,0.8)' }}
        >
          <div
            className="gradient-bg h-2 rounded-full transition-all duration-500"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        <Link href="/pricing">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            style={{ borderColor: 'rgba(124,58,237,0.4)', color: '#9775fa' }}
            onClick={() =>
              track({
                event_name: 'upgrade_clicked',
                event_data: { source: 'sidebar', current_plan: 'free' },
              })
            }
          >
            Upgrade for more
          </Button>
        </Link>
      </div>
    </div>
  )
}
