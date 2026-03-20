import { useState, useEffect, useRef } from 'react';

const NAV = [
  { id: 'introduction',    label: 'Introduction' },
  { id: 'authentication',  label: 'Authentication' },
  { id: 'rate-limiting',   label: 'Rate Limiting' },
  { id: 'errors',          label: 'Errors' },
  { id: 'tickets-list',    label: 'List Tickets',    group: 'Tickets' },
  { id: 'tickets-get',     label: 'Get Ticket',      group: 'Tickets' },
  { id: 'tickets-create',  label: 'Create Ticket',   group: 'Tickets' },
  { id: 'tickets-update',  label: 'Update Ticket',   group: 'Tickets' },
  { id: 'webhooks-intro',  label: 'Overview',        group: 'Webhooks' },
  { id: 'webhooks-verify', label: 'Verify Signature',group: 'Webhooks' },
  { id: 'zapier',          label: 'Zapier Triggers',  group: 'Zapier' },
  { id: 'health',          label: 'Health Check',    group: 'Utilities' },
];

function Code({ children, lang = 'bash' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(children.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-t-lg">
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{lang}</span>
        <button
          onClick={handleCopy}
          className="text-[10px] text-gray-600 hover:text-gray-300 transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-[#111] border border-t-0 border-[#2a2a2a] rounded-b-lg p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="text-gray-300 font-mono">{children.trim()}</code>
      </pre>
    </div>
  );
}

function Badge({ method }) {
  const colors = {
    GET:    'bg-blue-950 text-blue-400 border-blue-900',
    POST:   'bg-green-950 text-green-400 border-green-900',
    PATCH:  'bg-amber-950 text-amber-400 border-amber-900',
    DELETE: 'bg-red-950 text-red-400 border-red-900',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${colors[method] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {method}
    </span>
  );
}

function Endpoint({ method, path, description, params, body, response, example }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <Badge method={method} />
        <code className="text-sm font-mono text-gray-200">{path}</code>
      </div>
      {description && <p className="text-sm text-gray-400 mb-4 leading-relaxed">{description}</p>}

      {params && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Query Parameters</h4>
          <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
            {params.map((p, i) => (
              <div key={p.name} className={`flex items-start gap-3 px-4 py-3 text-sm ${i > 0 ? 'border-t border-[#2a2a2a]' : ''}`}>
                <code className="text-[#4ade80] font-mono text-xs shrink-0 mt-0.5">{p.name}</code>
                <span className="text-gray-600 text-xs shrink-0 mt-0.5">{p.type}</span>
                {p.required && <span className="text-red-500 text-[10px] shrink-0 mt-0.5">required</span>}
                <span className="text-gray-500 text-xs flex-1">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {body && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Request Body</h4>
          <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
            {body.map((p, i) => (
              <div key={p.name} className={`flex items-start gap-3 px-4 py-3 text-sm ${i > 0 ? 'border-t border-[#2a2a2a]' : ''}`}>
                <code className="text-[#4ade80] font-mono text-xs shrink-0 mt-0.5">{p.name}</code>
                <span className="text-gray-600 text-xs shrink-0 mt-0.5">{p.type}</span>
                {p.required && <span className="text-red-500 text-[10px] shrink-0 mt-0.5">required</span>}
                <span className="text-gray-500 text-xs flex-1">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {example && <Code lang="bash">{example}</Code>}
      {response && <Code lang="json">{response}</Code>}
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="mb-16 scroll-mt-8">
      <h2 className="text-xl font-bold text-white mb-4 pb-3 border-b border-[#2a2a2a]">{title}</h2>
      {children}
    </section>
  );
}

function GroupHeading({ label }) {
  return (
    <li className="pt-4 pb-1 first:pt-2">
      <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">{label}</span>
    </li>
  );
}

export default function ApiDocs() {
  const [active, setActive] = useState('introduction');
  const mainRef = useRef(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handler = () => {
      const sections = NAV.map(n => document.getElementById(n.id)).filter(Boolean);
      const scrollTop = el.scrollTop + 80;
      for (let i = sections.length - 1; i >= 0; i--) {
        if (sections[i].offsetTop <= scrollTop) {
          setActive(sections[i].id);
          break;
        }
      }
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const groups = {};
  let ungrouped = [];
  for (const item of NAV) {
    if (item.group) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    } else {
      ungrouped.push(item);
    }
  }

  return (
    <div className="flex h-screen bg-[#0d0d0d] text-gray-300 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-[#1e1e1e] bg-[#0d0d0d] overflow-y-auto">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-[#1e1e1e]">
          <a href="/" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#166534] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#4ade80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Sentinel</p>
              <p className="text-[10px] text-gray-600 leading-none mt-0.5">API Reference</p>
            </div>
          </a>
        </div>

        {/* Version badge */}
        <div className="px-6 py-3 border-b border-[#1e1e1e]">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#166534]/40 text-[#4ade80] border border-[#166534]/60 font-medium">v1.0</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-0.5">
            {ungrouped.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => scrollTo(item.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    active === item.id
                      ? 'bg-[#166534]/30 text-[#4ade80]'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
            {Object.entries(groups).map(([group, items]) => (
              <li key={group}>
                <GroupHeading label={group} />
                <ul className="space-y-0.5">
                  {items.map(item => (
                    <li key={item.id}>
                      <button
                        onClick={() => scrollTo(item.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          active === item.id
                            ? 'bg-[#166534]/30 text-[#4ade80]'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-6 py-4 border-t border-[#1e1e1e]">
          <a href="/admin/api-keys" className="text-xs text-[#4ade80] hover:text-green-300 transition-colors">
            Manage API Keys →
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-10 py-12">

          {/* ─── INTRODUCTION ─────────────────────────────────────────────── */}
          <Section id="introduction" title="Introduction">
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              The Sentinel IT Helpdesk API is a RESTful HTTP API that gives you programmatic access to tickets,
              webhooks, and automation workflows. Use it to build integrations with your existing tools,
              automate ticket workflows, or pull reporting data.
            </p>
            <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Base URL</p>
              <code className="text-sm text-[#4ade80] font-mono">https://your-sentinel-instance.com/v1</code>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Format', value: 'JSON' },
                { label: 'Auth', value: 'API Key' },
                { label: 'Rate limit', value: '100 req/min' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-sm font-medium text-gray-300">{value}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ─── AUTHENTICATION ───────────────────────────────────────────── */}
          <Section id="authentication" title="Authentication">
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              All API endpoints (except <code className="text-gray-300 text-xs">/v1/health</code>) require an API key passed in
              the <code className="text-gray-300 text-xs">X-API-Key</code> request header. You can generate and manage API keys
              from the <a href="/admin/api-keys" className="text-[#4ade80] hover:text-green-300">Admin &gt; API Keys</a> page.
            </p>
            <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-4 mb-4">
              <p className="text-xs text-amber-300">
                <span className="font-semibold">Security:</span> API keys are shown only once at creation. Store them in a secret manager, not in source code or environment files committed to version control.
              </p>
            </div>
            <Code lang="bash">{`curl https://your-sentinel.com/v1/tickets \\
  -H "X-API-Key: sk_live_abc123..."`}</Code>
            <p className="text-sm text-gray-500">If authentication fails, you will receive a <code className="text-gray-400 text-xs">401 Unauthorized</code> response.</p>
            <Code lang="json">{`{
  "error": "Invalid or inactive API key"
}`}</Code>
          </Section>

          {/* ─── RATE LIMITING ────────────────────────────────────────────── */}
          <Section id="rate-limiting" title="Rate Limiting">
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Each API key has a configurable rate limit (default 100 requests per minute). The current window's
              usage is included in every response via headers.
            </p>
            <div className="border border-[#2a2a2a] rounded-lg overflow-hidden mb-4">
              {[
                { header: 'X-RateLimit-Limit',     desc: 'Maximum requests allowed per minute for this key' },
                { header: 'X-RateLimit-Remaining', desc: 'Requests remaining in the current minute window' },
                { header: 'Retry-After',            desc: 'Seconds until the rate limit window resets (only on 429)' },
              ].map((h, i) => (
                <div key={h.header} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[#2a2a2a]' : ''}`}>
                  <code className="text-[#4ade80] font-mono text-xs shrink-0 mt-0.5 w-48">{h.header}</code>
                  <span className="text-gray-500 text-xs">{h.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-400 mb-2">When the rate limit is exceeded, you receive a <code className="text-gray-300 text-xs">429 Too Many Requests</code>:</p>
            <Code lang="json">{`{
  "error": "Rate limit exceeded",
  "retry_after": 42
}`}</Code>
          </Section>

          {/* ─── ERRORS ───────────────────────────────────────────────────── */}
          <Section id="errors" title="Errors">
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              All errors follow a consistent JSON format with an <code className="text-gray-300 text-xs">error</code> field containing a human-readable message.
            </p>
            <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
              {[
                { code: '400', label: 'Bad Request',           desc: 'Missing or invalid request parameters' },
                { code: '401', label: 'Unauthorized',          desc: 'Missing or invalid API key' },
                { code: '404', label: 'Not Found',             desc: 'The requested resource does not exist' },
                { code: '429', label: 'Too Many Requests',     desc: 'Rate limit exceeded for this API key' },
                { code: '500', label: 'Internal Server Error', desc: 'An unexpected server error occurred' },
              ].map((e, i) => (
                <div key={e.code} className={`flex items-start gap-4 px-4 py-3 ${i > 0 ? 'border-t border-[#2a2a2a]' : ''}`}>
                  <code className="text-amber-400 font-mono text-xs shrink-0 mt-0.5 w-10">{e.code}</code>
                  <span className="text-gray-300 text-xs shrink-0 w-36">{e.label}</span>
                  <span className="text-gray-500 text-xs">{e.desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* ─── TICKETS ──────────────────────────────────────────────────── */}
          <Section id="tickets-list" title="List Tickets">
            <Endpoint
              method="GET"
              path="/v1/tickets"
              description="Returns a paginated list of all tickets. Supports filtering by status, priority, and category."
              params={[
                { name: 'status',   type: 'string',  desc: 'Filter by status: open, in_progress, resolved, closed' },
                { name: 'priority', type: 'string',  desc: 'Filter by priority: low, medium, high, critical' },
                { name: 'category', type: 'string',  desc: 'Filter by category: hardware, software, network, access, account' },
                { name: 'limit',    type: 'integer', desc: 'Number of results to return (default 50, max 200)' },
                { name: 'offset',   type: 'integer', desc: 'Number of results to skip for pagination (default 0)' },
              ]}
              example={`curl https://your-sentinel.com/v1/tickets?status=open&priority=high \\
  -H "X-API-Key: sk_live_abc123..."`}
              response={`{
  "data": [
    {
      "id": 42,
      "title": "VPN connection drops every 30 minutes",
      "description": "Since the last Windows update...",
      "status": "open",
      "priority": "high",
      "category": "network",
      "submitter_name": "Jane Smith",
      "submitter_email": "jane@company.com",
      "assignee_name": "IT Staff",
      "created_at": "2026-03-20T09:15:00.000Z",
      "updated_at": "2026-03-20T09:15:00.000Z",
      "resolved_at": null,
      "sla_due_at": "2026-03-20T13:15:00.000Z"
    }
  ],
  "meta": {
    "total": 87,
    "limit": 50,
    "offset": 0
  }
}`}
            />
          </Section>

          <Section id="tickets-get" title="Get Ticket">
            <Endpoint
              method="GET"
              path="/v1/tickets/:id"
              description="Retrieve a single ticket by ID, including its comment thread."
              example={`curl https://your-sentinel.com/v1/tickets/42 \\
  -H "X-API-Key: sk_live_abc123..."`}
              response={`{
  "id": 42,
  "title": "VPN connection drops every 30 minutes",
  "status": "open",
  "priority": "high",
  "category": "network",
  "submitter_name": "Jane Smith",
  "assignee_name": "IT Staff",
  "created_at": "2026-03-20T09:15:00.000Z",
  "comments": [
    {
      "id": 1,
      "body": "Can you clarify which VPN client you're using?",
      "author_name": "IT Staff",
      "created_at": "2026-03-20T09:30:00.000Z"
    }
  ]
}`}
            />
          </Section>

          <Section id="tickets-create" title="Create Ticket">
            <Endpoint
              method="POST"
              path="/v1/tickets"
              description="Create a new support ticket. If submitter_email matches an active user, they will be set as the submitter."
              body={[
                { name: 'title',           type: 'string', required: true,  desc: 'Short description of the issue (max 200 chars)' },
                { name: 'description',     type: 'string', required: true,  desc: 'Full description of the problem' },
                { name: 'priority',        type: 'string', required: false, desc: 'low | medium (default) | high | critical' },
                { name: 'category',        type: 'string', required: false, desc: 'hardware | software (default) | network | access | account' },
                { name: 'submitter_email', type: 'string', required: false, desc: 'Email of the submitter. Must match an active Sentinel user.' },
              ]}
              example={`curl -X POST https://your-sentinel.com/v1/tickets \\
  -H "X-API-Key: sk_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Cannot access SharePoint",
    "description": "Getting a 403 error when opening the IT department site.",
    "priority": "high",
    "category": "access",
    "submitter_email": "jane@company.com"
  }'`}
              response={`{
  "id": 99,
  "title": "Cannot access SharePoint",
  "status": "open",
  "priority": "high",
  "category": "access",
  "created_at": "2026-03-20T10:00:00.000Z"
}`}
            />
          </Section>

          <Section id="tickets-update" title="Update Ticket">
            <Endpoint
              method="PATCH"
              path="/v1/tickets/:id"
              description="Update a ticket's status, priority, or assignee. All fields are optional — only include the ones you want to change."
              body={[
                { name: 'status',         type: 'string', required: false, desc: 'open | in_progress | resolved | closed' },
                { name: 'priority',       type: 'string', required: false, desc: 'low | medium | high | critical' },
                { name: 'assignee_email', type: 'string', required: false, desc: 'Email of the user to assign. Pass empty string to unassign.' },
              ]}
              example={`curl -X PATCH https://your-sentinel.com/v1/tickets/42 \\
  -H "X-API-Key: sk_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{"status": "resolved"}'`}
              response={`{
  "id": 42,
  "status": "resolved",
  "resolved_at": "2026-03-20T11:00:00.000Z",
  "updated_at": "2026-03-20T11:00:00.000Z"
}`}
            />
          </Section>

          {/* ─── WEBHOOKS ─────────────────────────────────────────────────── */}
          <Section id="webhooks-intro" title="Webhooks Overview">
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Sentinel can send real-time HTTP POST notifications to your endpoints when ticket events occur.
              Manage webhooks from the <a href="/admin/integrations" className="text-[#4ade80] hover:text-green-300">Integrations</a> page.
            </p>
            <h3 className="text-sm font-semibold text-white mb-3">Supported Events</h3>
            <div className="border border-[#2a2a2a] rounded-lg overflow-hidden mb-4">
              {[
                { event: 'ticket.created',  desc: 'A new ticket was submitted' },
                { event: 'ticket.updated',  desc: 'A ticket status, priority, or assignee changed' },
                { event: 'ticket.resolved', desc: 'A ticket was marked as resolved' },
                { event: 'ticket.closed',   desc: 'A ticket was closed' },
              ].map((e, i) => (
                <div key={e.event} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t border-[#2a2a2a]' : ''}`}>
                  <code className="text-[#4ade80] font-mono text-xs w-36 shrink-0">{e.event}</code>
                  <span className="text-gray-500 text-xs">{e.desc}</span>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-white mb-2">Payload Format</h3>
            <Code lang="json">{`{
  "event": "ticket.created",
  "timestamp": "2026-03-20T10:00:00.000Z",
  "data": {
    "id": 42,
    "title": "VPN not working",
    "status": "open",
    "priority": "high",
    "category": "network"
  }
}`}</Code>
          </Section>

          <Section id="webhooks-verify" title="Verify Webhook Signature">
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              All webhook deliveries include an <code className="text-gray-300 text-xs">X-Sentinel-Signature</code> header containing
              an HMAC-SHA256 signature of the raw request body. Use it to verify the request came from Sentinel.
            </p>
            <Code lang="javascript">{`import crypto from 'crypto';

export function verifyWebhook(rawBody, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Express example
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-sentinel-signature'];
  if (!verifyWebhook(req.body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  const event = JSON.parse(req.body);
  console.log('Received:', event.event, event.data.id);
  res.json({ received: true });
});`}</Code>
            <p className="text-sm text-gray-500">Always use <code className="text-gray-400 text-xs">crypto.timingSafeEqual</code> to prevent timing attacks when comparing signatures.</p>
          </Section>

          {/* ─── ZAPIER ───────────────────────────────────────────────────── */}
          <Section id="zapier" title="Zapier Triggers">
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Zapier polling triggers are available for use with the Zapier integration. All endpoints require an
              API key via the <code className="text-gray-300 text-xs">X-API-Key</code> header and support an optional
              <code className="text-gray-300 text-xs"> ?since=</code> ISO timestamp to filter results.
            </p>
            <div className="space-y-4">
              {[
                { path: '/api/zapier/triggers/new-ticket',      desc: 'Returns tickets created since the given timestamp.' },
                { path: '/api/zapier/triggers/resolved-ticket', desc: 'Returns tickets resolved since the given timestamp.' },
                { path: '/api/zapier/triggers/critical-ticket', desc: 'Returns critical tickets created since the given timestamp.' },
              ].map(e => (
                <div key={e.path} className="flex items-start gap-3">
                  <Badge method="GET" />
                  <div>
                    <code className="text-xs font-mono text-gray-200">{e.path}</code>
                    <p className="text-xs text-gray-500 mt-1">{e.desc}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-3">
                <Badge method="POST" />
                <div>
                  <code className="text-xs font-mono text-gray-200">/api/zapier/actions/create-ticket</code>
                  <p className="text-xs text-gray-500 mt-1">Create a ticket from a Zapier action. Accepts <code className="text-gray-400">title</code>, <code className="text-gray-400">description</code>, <code className="text-gray-400">priority</code>, <code className="text-gray-400">category</code>, <code className="text-gray-400">submitter_email</code>.</p>
                </div>
              </div>
            </div>
          </Section>

          {/* ─── HEALTH ───────────────────────────────────────────────────── */}
          <Section id="health" title="Health Check">
            <Endpoint
              method="GET"
              path="/v1/health"
              description="Returns the API status. No authentication required. Use this to verify the service is reachable."
              example={`curl https://your-sentinel.com/v1/health`}
              response={`{
  "status": "ok",
  "service": "sentinel-api",
  "timestamp": "2026-03-20T10:00:00.000Z"
}`}
            />
          </Section>

        </div>
      </main>
    </div>
  );
}
