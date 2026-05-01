import Link from 'next/link'
import Navbar from '@/components/Navbar'

export const metadata = {
  title: 'Acceptable Use Policy | Drafture',
  description: 'What you can and can\'t do with Drafture.',
}

export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <h1 className="text-4xl font-extrabold mb-2" style={{ color: '#e0e9ff' }}>Acceptable Use Policy</h1>
        <p className="text-sm mb-12" style={{ color: '#5a7dc4' }}>Effective April 27, 2026</p>

        <div className="prose-light space-y-6 text-base leading-relaxed" style={{ color: '#94afee' }}>
          <p>
            Drafture is a writing coach. The list below describes what you can and can&apos;t do with it.
            Violating these rules can result in account suspension or termination. We don&apos;t love having to enforce this. We will if we have to.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>You may use Drafture to</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Generate first drafts you intend to read, edit, fact-check, and revise into your own work.</li>
            <li>Practice explaining course material in your own voice.</li>
            <li>Brainstorm ideas, outlines, and counter-arguments.</li>
            <li>Translate your raw notes into a coherent response.</li>
            <li>Get unstuck when you have a blank page and a deadline.</li>
          </ul>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>You may not use Drafture to</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Cheat on assignments where your professor or school has prohibited AI assistance. Read your syllabus.</li>
            <li>Take exams, complete proctored work, or submit drafts as final answers without your own edits and verification.</li>
            <li>Generate content meant to harass, defame, threaten, or sexually target a real person.</li>
            <li>Generate content that exploits or sexualizes minors. Period.</li>
            <li>Generate content that promotes violence, self-harm, or hate against a protected group.</li>
            <li>Generate misinformation about elections, public health, or scientific consensus.</li>
            <li>Reverse-engineer or scrape the service, share your account, or resell access.</li>
            <li>Submit prompts that include other people&apos;s personal information without their consent.</li>
            <li>Use the service to violate any law or any third party&apos;s rights.</li>
          </ul>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>Reporting abuse</h2>
          <p>
            See something that breaks these rules? Email <a href="mailto:abuse@getdrafture.com" style={{ color: '#9775fa' }}>abuse@getdrafture.com</a>.
            We respond within 48 hours.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>Enforcement</h2>
          <p>
            We can suspend access immediately for clear violations, especially anything in the &ldquo;may not&rdquo; list. We will refund unused subscription time when we suspend an account in error.
          </p>

          <p className="pt-8">
            Read also: <Link href="/honor-code" style={{ color: '#9775fa' }}>Academic honor code</Link>,{' '}
            <Link href="/terms" style={{ color: '#9775fa' }}>Terms</Link>,{' '}
            <Link href="/privacy" style={{ color: '#9775fa' }}>Privacy</Link>.
          </p>
        </div>
      </main>
    </div>
  )
}
