import { Link } from 'react-router-dom';

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="text-white text-xl font-bold mb-4">{title}</h2>
      <div className="text-gray-400 leading-relaxed space-y-3 text-sm">{children}</div>
    </div>
  );
}

export default function Terms() {
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
          <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-gray-500 text-sm">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <p className="text-gray-400 text-sm leading-relaxed mb-10">
            Please read these Terms of Service ("Terms") carefully before using Sentinel. By accessing or using our Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
          </p>

          <Section title="1. Acceptance of Terms">
            <p>By creating an account or using Sentinel in any way, you confirm that you are at least 18 years old, have the legal authority to enter into these Terms on behalf of your organization, and agree to comply with all applicable laws.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>Sentinel is an AI-powered IT helpdesk platform ("Service") that enables organizations to manage support tickets, automate responses using the ATLAS AI system, and track IT operations. We provide the Service on a subscription basis, with a free trial period for new accounts.</p>
            <p>We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time with reasonable notice.</p>
          </Section>

          <Section title="3. User Accounts">
            <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.</p>
            <p>The account administrator is responsible for all activity that occurs under the organization's account, including actions taken by invited users.</p>
            <p>You may not share account credentials across multiple organizations or use the Service on behalf of a competitor without explicit written consent.</p>
          </Section>

          <Section title="4. Free Trial">
            <p>New accounts receive a 14-day free trial with full access to Sentinel features. No credit card is required to start a trial.</p>
            <p>At the end of your trial period, your account will be locked until you select a paid plan. Your data is preserved for 30 days after trial expiration. After 30 days without a subscription, your data may be permanently deleted.</p>
          </Section>

          <Section title="5. Subscription and Payment">
            <p>Paid plans are billed monthly in advance. Prices are listed in USD. We use Stripe to process all payments securely.</p>
            <p>By subscribing, you authorize us to charge your payment method on a recurring basis. You can update your payment method at any time through the billing portal.</p>
            <p>All fees are exclusive of applicable taxes. You are responsible for any taxes imposed on your purchase.</p>
            <p>We reserve the right to change pricing with 30 days' notice. If you disagree with a price change, you may cancel before the change takes effect.</p>
          </Section>

          <Section title="6. Cancellation Policy">
            <p>You may cancel your subscription at any time through the billing portal. Cancellation takes effect at the end of the current billing period — you retain full access until then.</p>
            <p>We do not provide refunds for partial months or unused subscription time, except where required by applicable law.</p>
            <p>Upon cancellation, your data is retained for 30 days. You may export your data before this period ends.</p>
          </Section>

          <Section title="7. Acceptable Use">
            <p>You agree not to use Sentinel to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Transmit unlawful, harmful, or abusive content</li>
              <li>Attempt to gain unauthorized access to our systems or other users' data</li>
              <li>Reverse engineer or extract the underlying source code or AI models</li>
              <li>Resell or sublicense the Service without written permission</li>
              <li>Use the Service to build a competing product</li>
              <li>Transmit malware, spam, or other malicious code</li>
              <li>Violate the privacy rights of others</li>
            </ul>
            <p>Violation of these terms may result in immediate account suspension or termination.</p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>Sentinel and the ATLAS AI system are owned by us and protected by intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the Service for your internal business operations.</p>
            <p>You retain ownership of your data. By using the Service, you grant us a limited license to process your data as necessary to provide the Service.</p>
          </Section>

          <Section title="9. Data and Privacy">
            <p>Our collection and use of personal information is governed by our <Link to="/privacy" className="text-green-400 hover:underline">Privacy Policy</Link>, which is incorporated into these Terms by reference.</p>
            <p>You are responsible for ensuring that your use of Sentinel complies with applicable data protection laws (including GDPR where applicable) and that you have appropriate authority to submit the data you provide.</p>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.</p>
            <p>ATLAS AI responses are provided as assistance only and should not replace professional IT judgment for critical systems.</p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, SENTINEL SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.</p>
            <p>OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE THREE MONTHS PRECEDING THE CLAIM.</p>
          </Section>

          <Section title="12. Governing Law">
            <p>These Terms are governed by and construed in accordance with the laws of the United States. Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration, except where prohibited by law.</p>
          </Section>

          <Section title="13. Changes to Terms">
            <p>We may revise these Terms at any time. For material changes, we will provide at least 14 days' notice via email to account administrators. Continued use of the Service after that date constitutes acceptance of the updated Terms.</p>
          </Section>

          <Section title="14. Contact">
            <p>Questions about these Terms should be sent to:</p>
            <div className="bg-gray-800 rounded-lg px-4 py-3 mt-2">
              <p><strong className="text-gray-200">Sentinel</strong></p>
              <p>Email: legal@sentinelaiapp.com</p>
              <p>Website: <Link to="/" className="text-green-400 hover:underline">sentinelaiapp.com</Link></p>
            </div>
          </Section>
        </div>

        <div className="mt-8 text-center text-gray-600 text-xs">
          <Link to="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
          {' · '}
          <Link to="/" className="hover:text-gray-400 transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
