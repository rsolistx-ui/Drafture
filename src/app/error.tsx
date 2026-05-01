'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Pen, RefreshCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(JSON.stringify({
      event: 'client_error_boundary',
      message: error.message,
      digest: error.digest,
    }))
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#070e21' }}>
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl gradient-bg-electric flex items-center justify-center mx-auto mb-6">
          <Pen className="w-8 h-8 text-white" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#9775fa' }}>Error</p>
        <h1 className="text-4xl font-extrabold mb-4" style={{ color: '#e0e9ff' }}>Something went sideways.</h1>
        <p className="mb-8" style={{ color: '#94afee' }}>
          The page crashed on our side. The team has a log of it. Try again, or head home.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => reset()} variant="gradient" size="lg" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Try again
          </Button>
          <Link href="/">
            <Button variant="outline" size="lg">Home</Button>
          </Link>
        </div>
        {error.digest && (
          <p className="text-xs mt-8" style={{ color: '#5a7dc4' }}>
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  )
}
