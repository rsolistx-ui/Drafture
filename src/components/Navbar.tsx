'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Pen } from 'lucide-react'

export default function Navbar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md"
      style={{ backgroundColor: 'rgba(7,14,33,0.85)', borderBottom: '1px solid rgba(26,58,110,0.5)' }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl" style={{ color: '#e0e9ff' }}>
          <div className="w-8 h-8 rounded-lg gradient-bg-electric flex items-center justify-center">
            <Pen className="w-4 h-4 text-white" />
          </div>
          Drafture
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: '#5a7dc4' }}>
          <Link href="#how-it-works" className="hover:text-blue-300 transition-colors">How it works</Link>
          <Link href="#pricing" className="hover:text-blue-300 transition-colors">Pricing</Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" style={{ color: '#94afee' }}>Log in</Button>
          </Link>
          <Link href="/signup">
            <Button variant="gradient" size="sm">Get started free</Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
