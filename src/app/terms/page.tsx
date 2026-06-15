import Link from 'next/link'
import Navbar from '@/components/Navbar'

export const metadata = {
  title: 'Terms of Service | Drafture',
  description: 'The terms that govern your use of Drafture.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <h1 className="text-4xl font-extrabold mb-2" style={{ color: '#e0e9ff' }}>Terms of Service</h1>
        <p className="text-sm mb-12" style={{ color: '#5a7dc4' }}>Effective April 27, 2026 · Last updated April 27, 2026</p>

        <div className="prose-light space-y-6 text-base leading-relaxed" style={{ color: '#94afee' }}>
          <p>
            These terms are a contract between you and Drafture, Inc. (&ldquo;Drafture,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;).
            By using Drafture you agree to them. If you don&apos;t agree, please don&apos;t use the service.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>1. What Drafture is</h2>
          <p>
            Drafture is a writing coach. It generates first drafts in your voice that you can edit, expand, and use as a starting point for academic and personal writing.
            Drafture is not a substitute for thinking, reading, or studying. The drafts it produces are starting points, not finished work.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>2. Your responsibilities</h2>
          <p>By using Drafture, you agree that:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>You are 13 or older.</li>
            <li>You will follow your school&apos;s academic integrity policy. If your professor or school prohibits AI assistance for an assignment, do not use Drafture for that assignment.</li>
            <li>You will not submit Drafture output as your own without meaningful edits and verification of facts and citations.</li>
            <li>You will not use Drafture to harass, defame, threaten, or impersonate anyone.</li>
            <li>You will not use Drafture to generate content that is illegal, that infringes others&apos; rights, or that violates the <Link href="/acceptable-use" style={{ color: '#9775fa' }}>Acceptable Use Policy</Link>.</li>
          </ul>
          <p>You are responsible for what you do with the drafts.</p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>3. Your account</h2>
          <p>
            Keep your password secret. You are responsible for activity on your account. Tell us right away if you think someone else has access.
            We may suspend or terminate accounts that violate these terms or our <Link href="/acceptable-use" style={{ color: '#9775fa' }}>Acceptable Use Policy</Link>.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>4. Plans and billing</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>The Free plan includes 3 drafts per month. Starter includes 30 drafts per month. Finals includes 150 drafts per month as fair use. Paid plans renew monthly.</li>
            <li>Stripe processes all payments. We do not store your card number.</li>
            <li>You can cancel anytime in billing settings. Cancellation takes effect at the end of your current billing period; we don&apos;t pro-rate refunds for unused time except where required by law.</li>
            <li>If a payment fails, your account is downgraded to Free until you update your payment method.</li>
            <li>If you believe you were charged in error, email <a href="mailto:billing@getdrafture.com" style={{ color: '#9775fa' }}>billing@getdrafture.com</a> within 30 days.</li>
          </ul>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>5. Ownership of drafts</h2>
          <p>
            You own the prompts you submit and the drafts Drafture produces from them. You grant us the limited right to process your prompts to run the service and to use de-identified, aggregated patterns to improve the product.
            We do not claim copyright over your work.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>6. Intellectual property</h2>
          <p>
            The Drafture name, logo, software, design system, and prompts are our property. You don&apos;t get a license to copy or repackage them.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>7. Disclaimers</h2>
          <p>
            Drafture is provided &ldquo;as is.&rdquo; AI output can be wrong. Verify facts and citations before relying on a draft. We do not warrant that the service will be uninterrupted, error-free, or fit for a particular purpose.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>8. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, Drafture is not liable for indirect, incidental, special, consequential, or punitive damages, including lost profits, lost data, or academic consequences.
            Our total liability for any claim related to the service is limited to the amount you paid us in the 12 months before the claim.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>9. Termination</h2>
          <p>
            You can stop using Drafture and delete your account at any time. We can suspend or terminate your account if you violate these terms. Sections 5 through 11 survive termination.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>10. Governing law and disputes</h2>
          <p>
            These terms are governed by the laws of the State of Delaware, without regard to conflict-of-laws principles.
            Any dispute that can&apos;t be resolved informally goes to binding arbitration in Wilmington, Delaware, under the rules of the American Arbitration Association.
            You and Drafture waive the right to a jury trial and to participate in a class action.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>11. Changes</h2>
          <p>
            We may update these terms. If we change them in a material way, we&apos;ll email you and post a notice on the site at least 7 days before the change takes effect. Continued use after the change means you accept it.
          </p>

          <p className="pt-8">
            Questions: <a href="mailto:legal@getdrafture.com" style={{ color: '#9775fa' }}>legal@getdrafture.com</a>.{' '}
            <Link href="/" style={{ color: '#9775fa' }}>Back to home</Link>.
          </p>
        </div>
      </main>
    </div>
  )
}
