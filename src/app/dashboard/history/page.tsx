'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'
import DashboardSidebar from '@/components/DashboardSidebar'

export default function HistoryPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      <DashboardSidebar />

      <div className="ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold" style={{ color: '#e0e9ff' }}>Post history</h1>
            <p className="mt-1" style={{ color: '#5a7dc4' }}>All your generated posts, saved for reference.</p>
          </div>

          <div
            className="rounded-2xl p-12 text-center"
            style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.6)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(124,58,237,0.15)' }}
            >
              <Clock className="w-8 h-8" style={{ color: '#7c3aed' }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#e0e9ff' }}>No posts yet</h3>
            <p className="mb-6" style={{ color: '#5a7dc4' }}>Generate your first post to see it here.</p>
            <Link href="/dashboard/generate">
              <Button variant="gradient">Draft your first post</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
