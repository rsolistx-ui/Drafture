'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pen, CheckCircle, AlertCircle } from 'lucide-react'

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const planParam = params.get('plan') ?? ''
  const nextParam = params.get('next') ?? '/dashboard'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, password, plan: planParam || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Signup failed. Please try again.')
        setSubmitting(false)
        return
      }

      // If a paid plan was requested, send straight to checkout.
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl)
        return
      }

      router.push(nextParam || '/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ backgroundColor: '#070e21' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl" style={{ color: '#e0e9ff' }}>
            <div className="w-8 h-8 rounded-lg gradient-bg-electric flex items-center justify-center">
              <Pen className="w-4 h-4 text-white" />
            </div>
            Drafture
          </Link>
          <h1 className="text-3xl font-extrabold mt-4" style={{ color: '#e0e9ff' }}>Start for free</h1>
          <p className="mt-2" style={{ color: '#5a7dc4' }}>3 posts/month. No card. Cancel anytime.</p>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.7)' }}
        >
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#fca5a5' }} />
              <p className="text-sm" style={{ color: '#fecaca' }}>{error}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#94afee' }}>Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Johnson"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'rgba(7,14,33,0.8)',
                  border: '1px solid rgba(26,58,110,0.8)',
                  color: '#e0e9ff',
                  '--tw-ring-color': '#7c3aed',
                } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#94afee' }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'rgba(7,14,33,0.8)',
                  border: '1px solid rgba(26,58,110,0.8)',
                  color: '#e0e9ff',
                  '--tw-ring-color': '#7c3aed',
                } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#94afee' }}>Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'rgba(7,14,33,0.8)',
                  border: '1px solid rgba(26,58,110,0.8)',
                  color: '#e0e9ff',
                  '--tw-ring-color': '#7c3aed',
                } as React.CSSProperties}
              />
            </div>

            <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create free account'}
            </Button>
          </form>

          <div className="mt-6 space-y-2">
            {['3 free drafts every month', 'No credit card required', 'Cancel or upgrade anytime'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm" style={{ color: '#5a7dc4' }}>
                <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#7c3aed' }} />
                {item}
              </div>
            ))}
          </div>

          <p className="text-center text-sm mt-6" style={{ color: '#5a7dc4' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: '#9775fa' }}>
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
