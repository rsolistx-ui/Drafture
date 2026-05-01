import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Check, Zap, Sparkles, Infinity } from 'lucide-react'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Try it out — no card required.',
    posts: '3 posts / month',
    cta: 'Get started',
    ctaHref: '/dashboard',
    highlight: false,
    features: [
      '3 discussion posts per month',
      'All post types (initial, classmate, instructor)',
      'Video transcript summarizer',
      'Style matching (your voice)',
      'Course notes library',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$9',
    period: '/ month',
    description: 'For students with weekly discussion requirements.',
    posts: '30 posts / month',
    cta: 'Start Starter',
    ctaHref: '/dashboard',   // Will wire to Stripe checkout once auth lands
    highlight: true,
    features: [
      '30 discussion posts per month',
      'Everything in Free',
      'PDF attachment support',
      'Priority generation (faster queue)',
      'Email support',
    ],
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: '$19',
    period: '/ month',
    description: 'For heavy coursework or multiple classes.',
    posts: 'Unlimited posts',
    cta: 'Go Unlimited',
    ctaHref: '/dashboard',   // Will wire to Stripe checkout once auth lands
    highlight: false,
    features: [
      'Unlimited discussion posts',
      'Everything in Starter',
      'Bulk generation (batch multiple prompts)',
      'Early access to new features',
      'Priority support',
    ],
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid rgba(26,58,110,0.4)' }}>
        <Link href="/" className="flex items-center gap-2 font-bold text-lg" style={{ color: '#e0e9ff' }}>
          <div className="w-7 h-7 rounded-lg gradient-bg-electric flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          Drafture
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm font-medium" style={{ color: '#5a7dc4' }}>
            Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-16">
        {/* Header */}
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{ backgroundColor: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#9775fa' }}
          >
            <Sparkles className="w-3 h-3" />
            Simple, transparent pricing
          </div>
          <h1 className="text-4xl font-extrabold mb-3" style={{ color: '#e0e9ff' }}>
            Pay only for what you use
          </h1>
          <p className="text-lg" style={{ color: '#5a7dc4' }}>
            All plans include AI detection resistance, style matching, and course notes.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl p-6 flex flex-col"
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
                  Most popular
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
                {plan.id === 'unlimited'
                  ? <span className="flex items-center gap-1"><Infinity className="w-3 h-3" /> Unlimited posts</span>
                  : plan.posts}
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

              <Link href={plan.ctaHref}>
                <Button
                  variant={plan.highlight ? 'gradient' : 'outline'}
                  className="w-full"
                  style={
                    !plan.highlight
                      ? { borderColor: 'rgba(26,58,110,0.8)', color: '#5a7dc4' }
                      : {}
                  }
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* Fine print */}
        <p className="text-center text-xs mt-10" style={{ color: '#2d5299' }}>
          All plans are billed monthly. Cancel anytime. Payments processed securely by Stripe.
          Post limits reset on the 1st of each month.
        </p>
      </div>
    </div>
  )
}
