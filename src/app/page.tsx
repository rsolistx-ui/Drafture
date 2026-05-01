import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/Navbar'
import { CheckCircle, Zap, Mic, Clock, ArrowRight, Pen } from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Off zero in 60 seconds',
    description: 'Paste the prompt and your raw thoughts. A coherent first draft lands before the panic does.',
  },
  {
    icon: Mic,
    title: 'In your voice',
    description: 'Upload a writing sample once. Drafture matches the rhythm, vocabulary, and structure you actually use, instead of stamping out one generic AI cadence.',
  },
  {
    icon: CheckCircle,
    title: 'Built for editing, not pasting',
    description: 'Every draft includes spots flagged for facts you should verify and lines worth replacing. The point is to ship work that is yours, faster.',
  },
  {
    icon: Clock,
    title: 'Hours back every week',
    description: 'Discussion boards are busywork. Use Drafture to brainstorm and outline, then put your own thinking on top.',
  },
]

const steps = [
  {
    step: '01',
    title: 'Drop in the prompt',
    description: 'Paste the prompt, drop a video link, paste your notes, or attach the rubric. Drafture reads all of it.',
  },
  {
    step: '02',
    title: 'Pick the post type',
    description: 'Initial post, classmate reply, or instructor reply. Tone, structure, and length adjust to match.',
  },
  {
    step: '03',
    title: 'Edit and own it',
    description: 'You get a starting point that sounds like you on a clear-headed day. Edit it. Fact-check it. Submit work that is actually yours.',
  },
]

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    description: 'Try it. No card.',
    features: ['3 drafts per month', 'All post types', 'Full quality. No limits on the engine.', 'No credit card required'],
    cta: 'Start for free',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '$9.99',
    period: '/month',
    description: 'For the consistently busy student.',
    features: ['30 drafts per month', 'All post types', 'Priority generation', 'Email support'],
    cta: 'Get Starter',
    href: '/signup?plan=starter',
    highlight: true,
  },
  {
    name: 'Unlimited',
    price: '$19.99',
    period: '/month',
    description: 'Five courses? Covered.',
    features: ['Unlimited drafts', 'All post types', 'Fastest generation', 'Priority support'],
    cta: 'Go Unlimited',
    href: '/signup?plan=unlimited',
    highlight: false,
  },
]

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-28 px-6 overflow-hidden noise">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/4 w-[900px] h-[600px] rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #7c3aed 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[500px] h-[400px] rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #06b6d4 0%, transparent 70%)' }}
        />

        <div className="relative max-w-4xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full mb-8 border"
            style={{
              backgroundColor: 'rgba(124, 58, 237, 0.15)',
              borderColor: 'rgba(124, 58, 237, 0.4)',
              color: '#b8a4ff',
            }}
          >
            <span className="animate-[flicker_4s_ease-in-out_infinite]">⏰</span>
            Drafture. Your voice, before 11:59 PM.
          </div>

          <h1 className="text-6xl md:text-7xl font-extrabold leading-tight mb-6" style={{ color: '#f0f4ff' }}>
            It&apos;s 11:47 PM.{' '}
            <br className="hidden sm:block" />
            <span className="gradient-text">Get unstuck in 60 seconds.</span>
          </h1>

          <p className="text-xl leading-relaxed max-w-2xl mx-auto mb-10" style={{ color: '#94afee' }}>
            You haven&apos;t read the chapter. The tab has been open since Tuesday. Paste the prompt and your notes.{' '}
            <span style={{ color: '#b8a4ff' }} className="font-semibold">We&apos;ll give you a first draft. You finish it.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button variant="gradient" size="lg" className="gap-2 shadow-lg" style={{ boxShadow: '0 0 32px rgba(124,58,237,0.4)' }}>
                Draft my post free <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="ghost" size="lg" style={{ color: '#94afee' }}>
                See how it works
              </Button>
            </Link>
          </div>

          <p className="text-sm mt-4" style={{ color: '#5a7dc4' }}>3 free drafts/month · No card · Read our <Link href="/honor-code" className="underline" style={{ color: '#7c8cc4' }}>honor code</Link></p>
        </div>

        {/* ── Mock UI Card ── */}
        <div className="relative max-w-4xl mx-auto mt-16">
          <div
            className="rounded-2xl p-6 shadow-2xl clock-glow"
            style={{ backgroundColor: '#0c1c3d', border: '1px solid rgba(124,58,237,0.25)' }}
          >
            <div className="flex items-center gap-2 mb-5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
              <span className="ml-3 font-mono text-sm" style={{ color: '#5a7dc4' }}>app.getdrafture.com</span>
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(124,58,237,0.2)', color: '#b8a4ff' }}>
                11:51 PM
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(7,14,33,0.8)', border: '1px solid rgba(26,58,110,0.6)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5a7dc4' }}>Professor&apos;s Prompt</p>
                <p className="text-sm leading-relaxed" style={{ color: '#c4d4ff' }}>
                  &ldquo;Based on Chapter 7, discuss how cognitive dissonance affects consumer behavior and provide a real-world example from your own experience.&rdquo;
                </p>
              </div>
              <div className="rounded-xl p-4 relative overflow-hidden" style={{ backgroundColor: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.35)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9775fa' }}>Your starting draft</p>
                <p className="text-sm leading-relaxed" style={{ color: '#c4d4ff' }}>
                  &ldquo;Cognitive dissonance shows up in the way we rationalize purchases after we make them. Last semester I bought a $200 textbook I barely cracked open, and spent two weeks convincing myself it was worth it...&rdquo;
                </p>
                <div className="absolute bottom-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(6,182,212,0.2)', color: '#22d3ee' }}>
                  312 words · in your voice
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-6" style={{ backgroundColor: '#030812' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4" style={{ color: '#e0e9ff' }}>Three steps. Under a minute.</h2>
            <p className="text-lg" style={{ color: '#5a7dc4' }}>Less time than finding a good excuse not to do it.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="relative">
                <div className="text-7xl font-black mb-4 leading-none" style={{ color: 'rgba(124,58,237,0.2)' }}>{s.step}</div>
                <h3 className="text-xl font-bold mb-2" style={{ color: '#e0e9ff' }}>{s.title}</h3>
                <p className="leading-relaxed" style={{ color: '#5a7dc4' }}>{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6" style={{ backgroundColor: '#070e21' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4" style={{ color: '#e0e9ff' }}>
              Built for how college <span className="gradient-text">actually</span> works
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: '#5a7dc4' }}>
              Every feature exists because someone had a post due in 20 minutes and nothing to say.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex gap-5 p-6 rounded-2xl transition-all duration-200 glass-dark"
                style={{ '--tw-border-opacity': '1' } as React.CSSProperties}
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl gradient-bg flex items-center justify-center">
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1" style={{ color: '#e0e9ff' }}>{f.title}</h3>
                  <p className="leading-relaxed" style={{ color: '#5a7dc4' }}>{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Honor section ── */}
      <section className="py-20 px-6" style={{ backgroundColor: '#030812' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9775fa' }}>How to use it well</p>
          <h2 className="text-3xl font-bold mb-4" style={{ color: '#e0e9ff' }}>A starting point, not a finish line.</h2>
          <p className="text-lg leading-relaxed mb-6" style={{ color: '#94afee' }}>
            Drafture writes a first draft in your voice. You edit it, verify what it claims, and put your thinking on top.
            If your professor has banned AI assistance for an assignment, that&apos;s where the line is for that assignment.
          </p>
          <Link href="/honor-code" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#9775fa' }}>
            Read our honor code <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-6" style={{ backgroundColor: '#070e21' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold mb-4" style={{ color: '#e0e9ff' }}>Pricing that makes sense</h2>
            <p className="text-lg" style={{ color: '#5a7dc4' }}>Less than one Chipotle bowl a month. Cancel anytime.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-center">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 ${plan.highlight ? 'gradient-bg shadow-2xl scale-105' : ''}`}
                style={plan.highlight
                  ? { boxShadow: '0 20px 60px rgba(124,58,237,0.35)' }
                  : { backgroundColor: '#0c1c3d', border: '1px solid rgba(26,58,110,0.8)' }
                }
              >
                <h3 className="text-xl font-bold mb-1" style={{ color: plan.highlight ? '#fff' : '#e0e9ff' }}>
                  {plan.name}
                </h3>
                <p className="text-sm mb-6" style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#5a7dc4' }}>
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold" style={{ color: plan.highlight ? '#fff' : '#e0e9ff' }}>
                    {plan.price}
                  </span>
                  <span style={{ color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#5a7dc4' }}>{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: plan.highlight ? 'rgba(255,255,255,0.8)' : '#7c3aed' }}
                      />
                      <span className="text-sm" style={{ color: plan.highlight ? 'rgba(255,255,255,0.85)' : '#94afee' }}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.href}>
                  <Button
                    className="w-full"
                    variant={plan.highlight ? 'default' : 'outline'}
                    style={plan.highlight
                      ? { background: 'white', color: '#7c3aed', fontWeight: 700 }
                      : { borderColor: 'rgba(124,58,237,0.5)', color: '#9775fa' }
                    }
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-6 relative overflow-hidden noise" style={{ backgroundColor: '#070e21' }}>
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 100%, #7c3aed 0%, transparent 60%)' }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl gradient-bg-electric flex items-center justify-center mx-auto mb-6 clock-glow">
            <Pen className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl font-extrabold mb-4" style={{ color: '#e0e9ff' }}>
            The tab won&apos;t close itself.
          </h2>
          <p className="text-lg mb-8" style={{ color: '#5a7dc4' }}>
            Start with 3 free drafts. No card. Just a way off zero.
          </p>
          <Link href="/signup">
            <Button variant="gradient" size="lg" className="gap-2" style={{ boxShadow: '0 0 32px rgba(124,58,237,0.4)' }}>
              Draft it free <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6" style={{ borderTop: '1px solid rgba(26,58,110,0.6)', backgroundColor: '#030812' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold" style={{ color: '#e0e9ff' }}>
            <div className="w-6 h-6 rounded-md gradient-bg-electric flex items-center justify-center">
              <Pen className="w-3.5 h-3.5 text-white" />
            </div>
            Drafture
          </div>
          <p className="text-sm" style={{ color: '#2d5299' }}>© 2026 Drafture. Your voice, before 11:59 PM.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm justify-center" style={{ color: '#2d5299' }}>
            <Link href="/honor-code" className="hover:text-blue-300 transition-colors">Honor code</Link>
            <Link href="/acceptable-use" className="hover:text-blue-300 transition-colors">Acceptable use</Link>
            <Link href="/privacy" className="hover:text-blue-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-blue-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
