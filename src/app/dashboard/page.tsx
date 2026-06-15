'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, FileText, Clock, Zap, Sparkles } from 'lucide-react'
import DashboardSidebar from '@/components/DashboardSidebar'
import { useEffect, useState } from 'react'
import { STYLE_STORAGE_KEY } from '@/lib/style/types'
import { getUsage } from '@/lib/usage/storage'

export default function DashboardPage() {
  const [hasStyle, setHasStyle] = useState(false)
  const [postsUsed, setPostsUsed]   = useState(0)
  const [postsLimit, setPostsLimit] = useState(3)
  const [allTime, setAllTime]       = useState(0)

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        setHasStyle(!!localStorage.getItem(STYLE_STORAGE_KEY))
        const usage = getUsage()
        setPostsUsed(usage.monthCount)
        setPostsLimit(usage.limit)
        setAllTime(usage.allTime)
      } catch { /* ok */ }
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      <DashboardSidebar postsUsed={postsUsed} postsLimit={postsLimit} allTime={allTime} />

      {/* Main content */}
      <div className="ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold" style={{ color: '#e0e9ff' }}>Good to see you 👋</h1>
            <p className="mt-1" style={{ color: '#5a7dc4' }}>Ready to knock out this week&apos;s posts?</p>
          </div>

          {/* Quick action */}
          <Link href="/dashboard/generate">
            <div
              className="gradient-bg rounded-2xl p-8 text-white mb-6 hover:opacity-95 transition-opacity cursor-pointer"
              style={{ boxShadow: '0 8px 40px rgba(124,58,237,0.35)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Draft a new post</h2>
                  <p style={{ color: 'rgba(255,255,255,0.7)' }}>Paste your prompt and get a response in seconds.</p>
                </div>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <Plus className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </Link>

          {/* Style matching CTA — show only if not set up */}
          {!hasStyle && (
            <Link href="/dashboard/style">
              <div
                className="flex items-center justify-between rounded-2xl p-5 mb-6 cursor-pointer hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'rgba(124,58,237,0.08)', border: '1px dashed rgba(124,58,237,0.35)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'rgba(124,58,237,0.15)' }}
                  >
                    <Sparkles className="w-5 h-5" style={{ color: '#9775fa' }} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#b8a4ff' }}>
                      Set up your writing style
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#5a7dc4' }}>
                      Paste 1–3 old discussion posts — future drafts will sound like you, not AI
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs shrink-0"
                  style={{ borderColor: 'rgba(124,58,237,0.4)', color: '#9775fa' }}
                >
                  Set up →
                </Button>
              </div>
            </Link>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: 'Posts this month', value: postsUsed,                             icon: FileText },
              { label: 'Posts remaining',  value: Math.max(0, postsLimit - postsUsed),   icon: Clock    },
              { label: 'All-time posts',   value: allTime,                               icon: Zap      },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl p-6"
                style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(124,58,237,0.15)' }}
                  >
                    <stat.icon className="w-5 h-5" style={{ color: '#9775fa' }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: '#5a7dc4' }}>{stat.label}</span>
                </div>
                <span className="text-3xl font-extrabold" style={{ color: '#e0e9ff' }}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
