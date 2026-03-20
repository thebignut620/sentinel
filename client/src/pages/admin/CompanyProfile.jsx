import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext.jsx';
import SpinnerButton from '../../components/SpinnerButton.jsx';
import api from '../../api/client.js';

const INDUSTRIES = ['Technology', 'Healthcare', 'Legal', 'Education', 'Finance', 'Retail', 'Manufacturing', 'Oil & Gas', 'Real Estate', 'Hospitality', 'Nonprofit', 'Government', 'Other'];

const INDUSTRY_COLORS = {
  Technology:    'bg-blue-900/40 text-blue-300 border-blue-800/50',
  Healthcare:    'bg-red-900/40 text-red-300 border-red-800/50',
  Legal:         'bg-amber-900/40 text-amber-300 border-amber-800/50',
  Education:     'bg-teal-900/40 text-teal-300 border-teal-800/50',
  Finance:       'bg-emerald-900/40 text-emerald-300 border-emerald-800/50',
  Retail:        'bg-orange-900/40 text-orange-300 border-orange-800/50',
  Manufacturing: 'bg-slate-800/80 text-slate-300 border-slate-700/50',
  'Oil & Gas':   'bg-yellow-900/40 text-yellow-300 border-yellow-800/50',
  'Real Estate': 'bg-indigo-900/40 text-indigo-300 border-indigo-800/50',
  Hospitality:   'bg-purple-900/40 text-purple-300 border-purple-800/50',
  Nonprofit:     'bg-pine-900/60 text-pine-300 border-pine-800/50',
  Government:    'bg-blue-950/60 text-blue-400 border-blue-900/50',
};
const EMPLOYEE_COUNTS = ['1–10', '11–50', '51–200', '201–500', '500+'];
const IT_STAFF_COUNTS = ['Just me', '2–3', '4–10', '10+'];
const OS_OPTIONS = ['Windows', 'macOS', 'Linux'];
const EMAIL_OPTIONS = ['Microsoft 365', 'Google Workspace', 'Both', 'Other'];
const COMM_OPTIONS = ['Slack', 'Microsoft Teams', 'Zoom', 'Google Meet', 'Webex', 'Discord'];
const INFRA_OPTIONS = ['Cloud-based', 'On-premise', 'Hybrid'];
const COMPLIANCE_OPTIONS = ['HIPAA', 'SOC 2', 'PCI-DSS', 'ISO 27001', 'GDPR', 'None'];
const ATLAS_STYLES = [
  { value: 'brief',    label: 'Brief & direct',     desc: '1–2 lines. Fast answers, no fluff.' },
  { value: 'balanced', label: 'Balanced',            desc: 'Short by default, more detail when needed.' },
  { value: 'detailed', label: 'Detailed & thorough', desc: 'Full explanations with the why behind each step.' },
];

const EMPTY = {
  company_name: '', industry: '', employee_count: '', it_staff_count: '',
  os_types: [], email_platform: '', comm_tools: [], other_software: '',
  common_issues: ['', '', ''],
  recurring_issues: '', problem_systems: '',
  has_vpn: false, network_equipment: '', infrastructure: '', compliance_reqs: [],
  atlas_style: 'balanced', atlas_clarify: true,
};

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-gray-200">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function FieldLabel({ children }) {
  return <p className="text-sm font-medium text-gray-400 mb-2">{children}</p>;
}

function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 active:scale-95
        ${selected
          ? 'bg-pine-800/70 border-pine-600/60 text-pine-200'
          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
        }`}
    >
      {label}
    </button>
  );
}

function Toggle({ checked, onChange, label, sublabel }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800/40 border border-gray-700/40">
      <div>
        <p className="text-sm font-medium text-gray-200">{label}</p>
        {sublabel && <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 shrink-0 ${checked ? 'bg-pine-600' : 'bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export default function CompanyProfile() {
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    api.get('/company-profile').then(r => {
      if (r.data) {
        setForm({
          ...EMPTY,
          ...r.data,
          common_issues: Array.isArray(r.data.common_issues) && r.data.common_issues.length === 3
            ? r.data.common_issues
            : ['', '', ''],
          has_vpn: !!r.data.has_vpn,
          atlas_clarify: r.data.atlas_clarify !== 0,
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = (field, val) => setForm(f => ({
    ...f,
    [field]: f[field].includes(val) ? f[field].filter(x => x !== val) : [...f[field], val],
  }));

  const setIssue = (i, val) => setForm(f => {
    const issues = [...f.common_issues];
    issues[i] = val;
    return { ...f, common_issues: issues };
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/company-profile', { ...form, completed: true });
      localStorage.setItem('sentinel_onboarding_done', '1');
      setSaveSuccess(true);
      addToast('Company profile saved. ATLAS is updated.', 'success');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      addToast('Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h1 className="text-2xl font-bold text-white">Company Profile</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium uppercase tracking-wider">
              ATLAS context
            </span>
            {form.industry && INDUSTRY_COLORS[form.industry] && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border uppercase tracking-wider ${INDUSTRY_COLORS[form.industry]}`}>
                {form.industry} Mode
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">ATLAS reads this before every response to give environment-specific advice.</p>
        </div>
      </div>

      {/* Company basics */}
      <div className="card p-6 space-y-4">
        <SectionHeader title="Company basics" />
        <div>
          <FieldLabel>Company name</FieldLabel>
          <input className="input w-full" value={form.company_name}
            onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
            placeholder="Acme Corp" />
        </div>
        <div>
          <FieldLabel>Industry</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {INDUSTRIES.map(i => (
              <Chip key={i} label={i} selected={form.industry === i}
                onClick={() => setForm(f => ({ ...f, industry: f.industry === i ? '' : i }))} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Employees</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {EMPLOYEE_COUNTS.map(c => (
                <Chip key={c} label={c} selected={form.employee_count === c}
                  onClick={() => setForm(f => ({ ...f, employee_count: f.employee_count === c ? '' : c }))} />
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>IT staff</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {IT_STAFF_COUNTS.map(c => (
                <Chip key={c} label={c} selected={form.it_staff_count === c}
                  onClick={() => setForm(f => ({ ...f, it_staff_count: f.it_staff_count === c ? '' : c }))} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tech stack */}
      <div className="card p-6 space-y-4">
        <SectionHeader title="Technology stack" subtitle="ATLAS uses this to give platform-specific commands and solutions." />
        <div>
          <FieldLabel>Operating systems</FieldLabel>
          <div className="flex gap-2">
            {OS_OPTIONS.map(o => (
              <Chip key={o} label={o} selected={form.os_types.includes(o)}
                onClick={() => toggle('os_types', o)} />
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Email platform</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {EMAIL_OPTIONS.map(e => (
              <Chip key={e} label={e} selected={form.email_platform === e}
                onClick={() => setForm(f => ({ ...f, email_platform: f.email_platform === e ? '' : e }))} />
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Communication tools</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {COMM_OPTIONS.map(c => (
              <Chip key={c} label={c} selected={form.comm_tools.includes(c)}
                onClick={() => toggle('comm_tools', c)} />
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Other key software</FieldLabel>
          <input className="input w-full" value={form.other_software}
            onChange={e => setForm(f => ({ ...f, other_software: e.target.value }))}
            placeholder="e.g. Salesforce, Adobe CC, AutoCAD, QuickBooks…" />
        </div>
      </div>

      {/* Common issues */}
      <div className="card p-6 space-y-4">
        <SectionHeader title="Common issues" subtitle="ATLAS recognizes these patterns and responds faster when it sees them." />
        <div>
          <FieldLabel>Your 3 most common IT problems</FieldLabel>
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <input key={i} className="input w-full" value={form.common_issues[i]}
                onChange={e => setIssue(i, e.target.value)}
                placeholder={['e.g. VPN disconnects frequently', 'e.g. Outlook keeps crashing', 'e.g. Printer not found'][i]} />
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Recurring issues <span className="text-gray-600 font-normal">(optional)</span></FieldLabel>
          <textarea className="input w-full resize-none" rows={2} value={form.recurring_issues}
            onChange={e => setForm(f => ({ ...f, recurring_issues: e.target.value }))}
            placeholder="e.g. Every Monday morning the shared drive disconnects for remote users…" />
        </div>
        <div>
          <FieldLabel>Systems that frequently cause problems <span className="text-gray-600 font-normal">(optional)</span></FieldLabel>
          <input className="input w-full" value={form.problem_systems}
            onChange={e => setForm(f => ({ ...f, problem_systems: e.target.value }))}
            placeholder="e.g. Legacy ERP, main conference room AV…" />
        </div>
      </div>

      {/* IT setup */}
      <div className="card p-6 space-y-4">
        <SectionHeader title="IT setup" subtitle="Helps ATLAS tailor network and access advice." />
        <Toggle
          checked={form.has_vpn}
          onChange={v => setForm(f => ({ ...f, has_vpn: v }))}
          label="Company uses a VPN"
          sublabel="ATLAS will check VPN status for any network or access issue"
        />
        <div>
          <FieldLabel>Network equipment <span className="text-gray-600 font-normal">(optional)</span></FieldLabel>
          <input className="input w-full" value={form.network_equipment}
            onChange={e => setForm(f => ({ ...f, network_equipment: e.target.value }))}
            placeholder="e.g. Cisco Meraki, Ubiquiti, Fortinet…" />
        </div>
        <div>
          <FieldLabel>Infrastructure</FieldLabel>
          <div className="flex gap-2">
            {INFRA_OPTIONS.map(opt => (
              <Chip key={opt} label={opt} selected={form.infrastructure === opt}
                onClick={() => setForm(f => ({ ...f, infrastructure: f.infrastructure === opt ? '' : opt }))} />
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Compliance requirements</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {COMPLIANCE_OPTIONS.map(c => (
              <Chip key={c} label={c} selected={form.compliance_reqs.includes(c)}
                onClick={() => toggle('compliance_reqs', c)} />
            ))}
          </div>
        </div>
      </div>

      {/* ATLAS preferences */}
      <div className="card p-6 space-y-4">
        <SectionHeader title="ATLAS preferences" subtitle="How ATLAS communicates with your team." />
        <div>
          <FieldLabel>Response style</FieldLabel>
          <div className="space-y-2">
            {ATLAS_STYLES.map(s => (
              <button key={s.value} type="button"
                onClick={() => setForm(f => ({ ...f, atlas_style: s.value }))}
                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150
                  ${form.atlas_style === s.value
                    ? 'bg-pine-900/50 border-pine-700/60 text-pine-200'
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:border-gray-600'
                  }`}
              >
                <p className="text-sm font-medium">{s.label}</p>
                <p className={`text-xs mt-0.5 ${form.atlas_style === s.value ? 'text-pine-400' : 'text-gray-600'}`}>{s.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <Toggle
          checked={form.atlas_clarify}
          onChange={v => setForm(f => ({ ...f, atlas_clarify: v }))}
          label="Allow ATLAS to ask clarifying questions"
          sublabel={form.atlas_clarify ? 'ATLAS asks when it needs more info to give the right answer.' : 'ATLAS always gives its best answer immediately.'}
        />
      </div>

      <div className="pb-4">
        <SpinnerButton
          onClick={handleSave}
          loading={saving}
          success={saveSuccess}
          className="btn-primary px-6 py-2.5 text-sm"
        >
          Save profile
        </SpinnerButton>
      </div>
    </div>
  );
}
