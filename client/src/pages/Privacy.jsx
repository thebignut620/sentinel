import { Link } from 'react-router-dom';

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="text-white text-xl font-bold mb-4">{title}</h2>
      <div className="text-gray-400 leading-relaxed space-y-3 text-sm">{children}</div>
    </div>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800/60 px-4 h-14 flex items-center justify-between max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-bold text-white tracking-tight">Sentinel</span>
        </Link>
        <Link to="/login" className="text-gray-400 hover:text-white text-sm transition-colors">Log in</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-12">
          <p className="text-green-500 text-sm font-semibold uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <p className="text-gray-400 text-sm leading-relaxed mb-10">
            Sentinel ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and share information when you use our IT helpdesk platform and related services ("Service"). By using Sentinel, you agree to the practices described in this policy.
          </p>

          <Section title="1. Information We Collect">
            <p><strong className="text-gray-200">Account Information:</strong> When you sign up, we collect your company name, administrator name, email address, and password (stored as a bcrypt hash).</p>
            <p><strong className="text-gray-200">User Data:</strong> Names, email addresses, and roles of employees added to your Sentinel account by your administrator.</p>
            <p><strong className="text-gray-200">Ticket Content:</strong> Text, descriptions, comments, attachments, and resolutions submitted through the platform.</p>
            <p><strong className="text-gray-200">Usage Data:</strong> Log data including IP addresses, browser type, pages visited, timestamps, and actions taken within the Service.</p>
            <p><strong className="text-gray-200">Payment Information:</strong> Billing details are processed and stored by Stripe. We do not store credit card numbers or full payment data on our servers.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use collected information to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Provide, operate, and improve the Sentinel platform</li>
              <li>Process AI analysis of ticket content via the ATLAS system (powered by Anthropic Claude)</li>
              <li>Send service-related emails including ticket notifications, trial reminders, and billing receipts</li>
              <li>Generate analytics and reports for your organization</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p>We do <strong className="text-gray-200">not</strong> sell your data to third parties, and we do not use your ticket content to train AI models.</p>
          </Section>

          <Section title="3. Data Storage and Security">
            <p>Your data is stored on secure servers hosted by Railway (PostgreSQL) and Vercel. All data is encrypted in transit using TLS 1.2 or higher.</p>
            <p>Passwords are hashed using bcrypt with a work factor of 10. JWT tokens used for authentication have an 8-hour expiry.</p>
            <p>We maintain access controls, audit logging, and monitoring to protect your data from unauthorized access. Each company's data is logically isolated within our infrastructure.</p>
            <p>We retain your data for as long as your account is active. Upon account deletion or cancellation, data is retained for 30 days before permanent deletion, allowing for recovery if needed.</p>
          </Section>

          <Section title="4. Third-Party Services">
            <p>Sentinel integrates with third-party services that have their own privacy policies:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-gray-200">Anthropic (Claude):</strong> Ticket content is sent to Anthropic's API for AI analysis. Anthropic does not use API data for model training.</li>
              <li><strong className="text-gray-200">Stripe:</strong> Payment processing. Stripe's privacy policy governs billing data.</li>
              <li><strong className="text-gray-200">Slack, Jira, Microsoft 365, Google Workspace:</strong> Only connected when you explicitly configure these integrations.</li>
              <li><strong className="text-gray-200">PagerDuty:</strong> Incident alerting, only when configured.</li>
            </ul>
          </Section>

          <Section title="5. Your Rights">
            <p>Depending on your location, you may have the following rights:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-gray-200">Access:</strong> Request a copy of the data we hold about you</li>
              <li><strong className="text-gray-200">Correction:</strong> Update inaccurate information via your profile settings</li>
              <li><strong className="text-gray-200">Deletion:</strong> Request deletion of your account and associated data</li>
              <li><strong className="text-gray-200">Portability:</strong> Export your ticket data in standard formats via the API</li>
              <li><strong className="text-gray-200">Objection:</strong> Opt out of non-essential communications via notification preferences</li>
            </ul>
            <p>To exercise these rights, contact us at the email below.</p>
          </Section>

          <Section title="6. Cookies">
            <p>Sentinel uses minimal browser storage. We use <code className="bg-gray-800 px-1 rounded text-green-400">localStorage</code> to store your authentication token and UI preferences (sidebar state, onboarding status). We do not use third-party tracking cookies or advertising cookies.</p>
          </Section>

          <Section title="7. Children's Privacy">
            <p>Sentinel is designed for business use and is not intended for individuals under the age of 16. We do not knowingly collect personal information from children.</p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. When we make significant changes, we will notify account administrators by email. Continued use of the Service after changes constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="9. Contact Us">
            <p>For privacy-related questions, data requests, or concerns, contact us at:</p>
            <div className="bg-gray-800 rounded-lg px-4 py-3 mt-2">
              <p><strong className="text-gray-200">Sentinel</strong></p>
              <p>Email: privacy@sentinelaiapp.com</p>
              <p>Website: <Link to="/" className="text-green-400 hover:underline">sentinelaiapp.com</Link></p>
            </div>
          </Section>
        </div>

        <div className="mt-8 text-center text-gray-600 text-xs">
          <Link to="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
          {' · '}
          <Link to="/" className="hover:text-gray-400 transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
