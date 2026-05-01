import Link from 'next/link'
import Navbar from '@/components/Navbar'

export const metadata = {
  title: 'Privacy Policy | Drafture',
  description: 'How Drafture collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070e21' }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <h1 className="text-4xl font-extrabold mb-2" style={{ color: '#e0e9ff' }}>Privacy Policy</h1>
        <p className="text-sm mb-12" style={{ color: '#5a7dc4' }}>Effective April 27, 2026 · Last updated April 27, 2026</p>

        <div className="prose-light space-y-6 text-base leading-relaxed" style={{ color: '#94afee' }}>
          <p>
            Drafture is a writing coach for college students. This policy explains what data we collect, why, and how you can control it.
            If anything below feels unclear, email us at <a href="mailto:privacy@getdrafture.com" style={{ color: '#9775fa' }}>privacy@getdrafture.com</a>.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>1. What we collect</h2>
          <p>When you create an account, we collect:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your name and email address.</li>
            <li>Hashed password (we never store passwords in plaintext).</li>
            <li>Your subscription plan and Stripe customer ID (we never see or store your card number).</li>
          </ul>
          <p>When you use the product, we collect:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The prompts and source material you submit, the drafts we produce, and minimal metadata (post type, word count, generation cost).</li>
            <li>Aggregate usage data such as which pages you visit, browser type, and approximate location derived from your IP.</li>
            <li>Optional writing samples you upload to train your style fingerprint. These remain in your browser by default.</li>
          </ul>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>2. Why we collect it</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Run the product.</strong> We send your prompt to Anthropic to generate a draft, then store the result in your account so you can find it later.</li>
            <li><strong>Bill you.</strong> Stripe handles all card data. We only store a customer reference.</li>
            <li><strong>Stop abuse.</strong> Rate limits and spend caps need usage telemetry.</li>
            <li><strong>Improve quality.</strong> Aggregate, de-identified telemetry guides prompt updates. We do not train AI models on your prompts.</li>
          </ul>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>3. Who sees your content</h2>
          <p>
            Your prompts and drafts are visible only to you and to a small set of subprocessors that make the product run:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Anthropic</strong> processes your prompt to generate a draft. Anthropic does not train its models on Drafture API traffic.</li>
            <li><strong>Supabase</strong> hosts our database and authentication.</li>
            <li><strong>Vercel</strong> hosts the application.</li>
            <li><strong>Stripe</strong> processes payments.</li>
            <li><strong>PostHog</strong> processes anonymized product analytics.</li>
            <li><strong>Upstash</strong> handles rate-limit counters.</li>
          </ul>
          <p>
            We do not sell your data. We do not share content with universities, professors, or detection vendors.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>4. How long we keep it</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Account data: as long as your account exists. Delete your account anytime in settings.</li>
            <li>Generated drafts: stored in your history until you delete them.</li>
            <li>Aggregate telemetry: up to 24 months.</li>
            <li>Billing records: 7 years, as required by tax law.</li>
          </ul>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>5. Your rights</h2>
          <p>
            Depending on where you live (GDPR, CCPA, or similar), you can ask us to: see your data, correct it, delete it, restrict its use, or move it to another service.
            Email <a href="mailto:privacy@getdrafture.com" style={{ color: '#9775fa' }}>privacy@getdrafture.com</a> with the request and we will respond within 30 days.
            We verify your identity before acting on any request.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>6. Children</h2>
          <p>
            Drafture is for users 13 and older. If you are under 13, do not create an account. If we discover an account belongs to a child under 13, we delete it.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>7. Security</h2>
          <p>
            We encrypt traffic over TLS, encrypt data at rest in Supabase, and rotate keys regularly.
            No system is perfectly secure; if a breach affects you, we will notify you within 72 hours of confirmation.
          </p>

          <h2 className="text-2xl font-bold pt-6" style={{ color: '#e0e9ff' }}>8. Changes</h2>
          <p>
            If we change this policy in a material way, we will email you and post a notice on the site at least 7 days before the change takes effect.
          </p>

          <p className="pt-8">
            Questions: <a href="mailto:privacy@getdrafture.com" style={{ color: '#9775fa' }}>privacy@getdrafture.com</a>.{' '}
            <Link href="/" style={{ color: '#9775fa' }}>Back to home</Link>.
          </p>
        </div>
      </main>
    </div>
  )
}
