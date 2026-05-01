import Link from 'next/link'
import Navbar from '@/components/Navbar'

export const metadata = {
  title: 'Academic Honor Code | Drafture',
  description: 'How to use Drafture honestly. Drafts are starting points, not finished work.',
}

export default function HonorCodePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <h1 className="text-4xl font-extrabold mb-2" style={{ color: '#e0e9ff' }}>Academic Honor Code</h1>
        <p className="text-sm mb-12" style={{ color: '#5a7dc4' }}>The deal we make with you, and the deal we ask you to make with yourself.</p>

        <div className="prose-light space-y-6 text-base leading-relaxed" style={{ color: '#94afee' }}>
          <p className="text-lg" style={{ color: '#c4d4ff' }}>
            Drafture is a writing coach, not a homework service. Read this before you use it.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>What we believe</h2>
          <p>
            College writing is partly about producing a thing and largely about thinking your way to a thing. AI tools are now part of how people write, the way calculators are part of how people do math.
            That doesn&apos;t mean every assignment is open to AI use. Your school sets the rules. Your professor sets the rules. We don&apos;t.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>The deal</h2>
          <p>When you use Drafture, you agree to:</p>
          <ol className="list-decimal pl-6 space-y-3">
            <li>
              <strong>Check your syllabus first.</strong> If your professor has banned AI assistance on a specific assignment, don&apos;t use Drafture for it. We can&apos;t enforce this for you, only you can.
            </li>
            <li>
              <strong>Treat every draft as a starting point.</strong> Read it. Edit it. Verify the facts. Replace anything that doesn&apos;t sound like you.
              The draft is meant to get you off zero, not across the finish line.
            </li>
            <li>
              <strong>Verify citations.</strong> AI sometimes invents sources that look real and aren&apos;t. If a draft cites a study or a court case, look it up before you submit it. Always.
            </li>
            <li>
              <strong>Disclose AI use when your school requires it.</strong> Many schools now ask you to declare AI assistance. Do it.
            </li>
            <li>
              <strong>Don&apos;t use Drafture for proctored exams or exam-equivalent work.</strong> That&apos;s the line.
            </li>
          </ol>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>What we won&apos;t do</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>We will not help you defeat a specific detector or impersonate a specific person&apos;s writing.</li>
            <li>We will not produce content that is illegal, that targets a real person abusively, or that exploits minors.</li>
            <li>We will not pretend to be a human if you ask the service whether it&apos;s AI. It is.</li>
          </ul>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>If you&apos;re unsure</h2>
          <p>
            Ask your professor. Most professors will tell you exactly where the line is for their class.
            If you can&apos;t reach them and you&apos;re unsure, don&apos;t submit AI-assisted work for that assignment. The cost of asking is a slightly awkward email. The cost of not asking can be your degree.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>If you mess up</h2>
          <p>
            If you submitted Drafture output as your own and your school is asking questions, the right move is usually to be honest with your professor early. We can&apos;t legally counsel you. We can tell you that the people we&apos;ve seen survive these conversations are the ones who admit it before they&apos;re cornered.
          </p>

          <p className="pt-8">
            See also: <Link href="/acceptable-use" style={{ color: '#9775fa' }}>Acceptable Use Policy</Link>,{' '}
            <Link href="/terms" style={{ color: '#9775fa' }}>Terms</Link>.
          </p>
        </div>
      </main>
    </div>
  )
}
