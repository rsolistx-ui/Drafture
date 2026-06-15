'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Check, Zap, Sparkles, ShieldCheck } from 'lucide-react'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Try the workflow before you pay.',
    posts: '3 posts / month',
    cta: 'Get started',
    highlight: false,
    features: [
      '3 discussion posts per month',
      'Initial, classmate, and instructor replies',
      'Video transcript summaries',
      'Style matching',
      'Course notes library',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$9.99',
    period: '/ month',
    description: 'For one or two discussion-heavy classes.',
    posts: '30 posts / month',
    cta: 'Start Starter',
    highlight: true,
    features: [
      '30 discussion posts per month',
      'Everything in Free',
      'PDF attachment support',
      'Readiness checklist after every draft',
      'Email support',
    ],
  },
  {
    id: 'unlimited',
    name: 'Finals',
    price: '$19.99',
    period: '/ month',
    description: 'For heavy coursework weeks and multiple classes.',
    posts: '150 posts / month fair use',
    cta: 'Go Finals',
    highlight: false,
    features: [
      '150 discussion posts per month',
      'Everything in Starter',
      'Best for multiple active courses',
      'Early access to new coaching tools',
      'Priority support',
    ],
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function startCheckout(planId: string) {
    if (planId === 'free') {
      router.push('/dashboard')
      return
    }

    setLoadingPlan(planId)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json()
      if (res.status === 401) {
        router.push(`/signup?plan=${planId}`)
        return
      }
      if (!res.ok || !data.url) {
        setError(data.error || 'Checkout is not available right now.')
        return
      }
      window.location.assign(data.url)
    } catch {
      setError('Checkout is not available right now.')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      <header className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid rgba(26,58,110,0.4)' }}>
        <Link href="/" className="flex items-center gap-2 font-bold text-lg" style={{ color: '#e0e9ff' }}>
          <div className="w-7 h-7 rounded-lg gradient-bg-electric flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          Drafture
        </Link>
        <Link href="/dashboard" className="text-sm font-medium" style={{ color: '#5a7dc4' }}>
          Dashboard
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-16">
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{ backgroundColor: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#9775fa' }}
          >
            <Sparkles className="w-3 h-3" />
            Student pricing
          </div>
          <h1 className="text-4xl font-extrabold mb-3" style={{ color: '#e0e9ff' }}>
            Pay for the weeks you need help
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: '#5a7dc4' }}>
            Drafture is priced below general AI assistant plans because it does one job: turn your course material into a draft you can revise, explain, and stand behind.
          </p>
        </div>

        {error && (
          <div
            className="mb-6 rounded-xl px-4 py-3 text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
          >
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="rounded-xl p-6 flex flex-col"
              style={
                plan.highlight
                  ? {
                      background: 'linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(76,29,149,0.3) 100%)',
                      border: '1px solid rgba(124,58,237,0.5)',
                      boxShadow: '0 8px 40px rgba(124,58,237,0.2)',
                    }
                  : {
                      backgroundColor: '#0c1c3d',
                      border: '1px solid rgba(26,58,110,0.6)',
                    }
              }
            >
              {plan.highlight && (
                <div
                  className="inline-flex self-start text-xs font-bold px-2.5 py-1 rounded-full mb-4"
                  style={{ backgroundColor: 'rgba(124,58,237,0.3)', color: '#c4b5fd' }}
                >
                  Best fit
                </div>
              )}

              <h2 className="text-xl font-extrabold mb-1" style={{ color: '#e0e9ff' }}>{plan.name}</h2>
              <p className="text-sm mb-4" style={{ color: '#5a7dc4' }}>{plan.description}</p>

              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-extrabold" style={{ color: '#e0e9ff' }}>{plan.price}</span>
                <span className="text-sm pb-1" style={{ color: '#5a7dc4' }}>{plan.period}</span>
              </div>
              <div
                className="text-xs font-semibold px-2.5 py-1 rounded-full self-start mb-6"
                style={{
                  backgroundColor: plan.highlight ? 'rgba(124,58,237,0.25)' : 'rgba(26,58,110,0.5)',
                  color: plan.highlight ? '#c4b5fd' : '#5a7dc4',
                }}
              >
                {plan.posts}
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#94afee' }}>
                    <Check
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: plan.highlight ? '#9775fa' : '#4ade80' }}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlight ? 'gradient' : 'outline'}
                className="w-full"
                disabled={loadingPlan === plan.id}
                onClick={() => startCheckout(plan.id)}
                style={
                  !plan.highlight
                    ? { borderColor: 'rgba(26,58,110,0.8)', color: '#5a7dc4' }
                    : {}
                }
              >
                {loadingPlan === plan.id ? 'Opening checkout...' : plan.cta}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-start gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(12,28,61,0.65)', border: '1px solid rgba(26,58,110,0.5)' }}>
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
          <p className="text-xs leading-relaxed" style={{ color: '#5a7dc4' }}>
            All plans are billed monthly. Cancel anytime in Stripe billing. Limits reset on the 1st of each month. Finals is a fair-use plan designed for real coursework, not automated bulk generation.
          </p>
        </div>
      </div>
    </div>
  )
}
