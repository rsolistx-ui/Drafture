import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Pen, ArrowRight } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#070e21' }}>
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl gradient-bg-electric flex items-center justify-center mx-auto mb-6">
          <Pen className="w-8 h-8 text-white" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#9775fa' }}>404</p>
        <h1 className="text-4xl font-extrabold mb-4" style={{ color: '#e0e9ff' }}>That page is on extension.</h1>
        <p className="mb-8" style={{ color: '#94afee' }}>
          Either the link is wrong or we deleted the page. The home page is still where you left it.
        </p>
        <Link href="/">
          <Button variant="gradient" size="lg" className="gap-2">
            Back to home <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
