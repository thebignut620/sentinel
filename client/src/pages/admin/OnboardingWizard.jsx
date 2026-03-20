import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import sentinelLogo from '../../assets/sentinel_logo.png';
import api from '../../api/client.js';

const TOTAL_STEPS = 5;

const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Legal', 'Education', 'Retail', 'Manufacturing', 'Real Estate', 'Nonprofit', 'Government', 'Other'];
const EMPLOYEE_COUNTS = ['1–10', '11–50', '51–200', '201–500', '500+'];
const IT_STAFF_COUNTS = ['Just me', '2–3', '4–10', '10+'];
const OS_OPTIONS = ['Windows', 'macOS', 'Linux'];
const EMAIL_OPTIONS = ['Microsoft 365', 'Google Workspace', 'Both', 'Other'];
const COMM_OPTIONS = ['Slack', 'Microsoft Teams', 'Zoom', 'Google Meet', 'Webex', 'Discord'];
const INFRA_OPTIONS = ['Cloud-based', 'On-premise', 'Hybrid'];
const COMPLIANCE_OPTIONS = ['HIPAA', 'SOC 2', 'PCI-DSS', 'ISO 27001', 'GDPR', 'None'];

const EMPTY_FORM = {
  company_name: '', industry: '', employee_count: '', it_staff_count: '',
  os_types: [], email_platform: '', comm_tools: [], other_software: '',
  common_issues: ['', '', ''],
  recurring_issues: '', problem_systems: '',
  has_vpn: false, network_equipment: '', infrastructure: '', compliance_reqs: [],
  atlas_style: 'balanced', atlas_clarify: true,
};

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

function FieldLabel({ children }) {
  return <p className="text-sm font-medium text-gray-300 mb-2">{children}</p>;
}

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`h-2 rounded-full transition-all duration-300
            ${i < current - 1 ? 'w-6 bg-pine-500' : i === current - 1 ? 'w-8 bg-pine-400' : 'w-6 bg-gray-700'}`}
          />
        </div>
      ))}
      <span className="text-xs text-gray-500 ml-1">{current} of {TOTAL_STEPS}</span>
    </div>
  );
}

function Step1({ form, setForm }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Company basics</h2>
        <p className="text-sm text-gray-500">Help ATLAS understand who it's working with.</p>
      </div>
      <div className="space-y-4">
        <div>
          <FieldLabel>Company name</FieldLabel>
          <input
            className="input w-full"
            value={form.company_name}
            onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
            placeholder="Acme Corp"
          />
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
            <FieldLabel>Number of employees</FieldLabel>
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
    </div>
  );
}

function Step2({ form, setForm }) {
  const toggle = (field, val) => setForm(f => ({
    ...f,
    [field]: f[field].includes(val) ? f[field].filter(x => x !== val) : [...f[field], val],
  }));
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Technology stack</h2>
        <p className="text-sm text-gray-500">ATLAS will tailor every answer to your exact environment.</p>
      </div>
      <div className="space-y-4">
        <div>
          <FieldLabel>Operating systems used</FieldLabel>
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
          <FieldLabel>Other key software your team uses daily</FieldLabel>
          <input
            className="input w-full"
            value={form.other_software}
            onChange={e => setForm(f => ({ ...f, other_software: e.target.value }))}
            placeholder="e.g. Salesforce, Adobe CC, AutoCAD, QuickBooks…"
          />
        </div>
      </div>
    </div>
  );
}

function Step3({ form, setForm }) {
  const setIssue = (i, val) => setForm(f => {
    const issues = [...f.common_issues];
    issues[i] = val;
    return { ...f, common_issues: issues };
  });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Common issues</h2>
        <p className="text-sm text-gray-500">ATLAS will recognize these patterns and respond faster.</p>
      </div>
      <div className="space-y-4">
        <div>
          <FieldLabel>Your 3 most common IT problems</FieldLabel>
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <input
                key={i}
                className="input w-full"
                value={form.common_issues[i]}
                onChange={e => setIssue(i, e.target.value)}
                placeholder={['e.g. VPN disconnects frequently', 'e.g. Outlook keeps crashing', 'e.g. Printer not found'][i]}
              />
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Any known recurring issues? <span className="text-gray-600 font-normal">(optional)</span></FieldLabel>
          <textarea
            className="input w-full resize-none"
            rows={2}
            value={form.recurring_issues}
            onChange={e => setForm(f => ({ ...f, recurring_issues: e.target.value }))}
            placeholder="e.g. Every Monday morning the shared drive disconnects for remote users…"
          />
        </div>
        <div>
          <FieldLabel>Systems that frequently cause problems <span className="text-gray-600 font-normal">(optional)</span></FieldLabel>
          <input
            className="input w-full"
            value={form.problem_systems}
            onChange={e => setForm(f => ({ ...f, problem_systems: e.target.value }))}
            placeholder="e.g. Legacy ERP, the main conference room AV setup…"
          />
        </div>
      </div>
    </div>
  );
}

function Step4({ form, setForm }) {
  const toggleCompliance = val => setForm(f => ({
    ...f,
    compliance_reqs: f.compliance_reqs.includes(val)
      ? f.compliance_reqs.filter(x => x !== val)
      : [...f.compliance_reqs, val],
  }));
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">IT setup</h2>
        <p className="text-sm text-gray-500">Helps ATLAS give network and access advice that fits your environment.</p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
          <div>
            <p className="text-sm font-medium text-gray-200">Do you use a VPN?</p>
            <p className="text-xs text-gray-500 mt-0.5">ATLAS will check VPN status for any network issue</p>
          </div>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, has_vpn: !f.has_vpn }))}
            className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${form.has_vpn ? 'bg-pine-600' : 'bg-gray-600'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${form.has_vpn ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div>
          <FieldLabel>Network equipment <span className="text-gray-600 font-normal">(optional)</span></FieldLabel>
          <input
            className="input w-full"
            value={form.network_equipment}
            onChange={e => setForm(f => ({ ...f, network_equipment: e.target.value }))}
            placeholder="e.g. Cisco Meraki, Ubiquiti, Fortinet…"
          />
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
          <FieldLabel>Compliance requirements <span className="text-gray-600 font-normal">(select all that apply)</span></FieldLabel>
          <div className="flex flex-wrap gap-2">
            {COMPLIANCE_OPTIONS.map(c => (
              <Chip key={c} label={c} selected={form.compliance_reqs.includes(c)}
                onClick={() => toggleCompliance(c)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step5({ form, setForm }) {
  const styles = [
    { value: 'brief',    label: 'Brief & direct',      desc: '1–2 lines. Fast answers, no fluff.' },
    { value: 'balanced', label: 'Balanced',             desc: 'Short by default, more detail when needed.' },
    { value: 'detailed', label: 'Detailed & thorough',  desc: 'Full explanations with the why behind each step.' },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">ATLAS preferences</h2>
        <p className="text-sm text-gray-500">How should ATLAS communicate with your team?</p>
      </div>
      <div className="space-y-4">
        <div>
          <FieldLabel>Preferred response style</FieldLabel>
          <div className="space-y-2">
            {styles.map(s => (
              <button
                key={s.value}
                type="button"
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
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
          <div>
            <p className="text-sm font-medium text-gray-200">Ask clarifying questions?</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {form.atlas_clarify ? 'ATLAS will ask when it needs more info to give the right answer.' : 'ATLAS will always give its best answer immediately without asking.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, atlas_clarify: !f.atlas_clarify }))}
            className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${form.atlas_clarify ? 'bg-pine-600' : 'bg-gray-600'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${form.atlas_clarify ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSkip = () => {
    localStorage.setItem('sentinel_onboarding_done', '1');
    navigate('/dashboard', { replace: true });
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
    }
  };

  const handleBack = () => setStep(s => s - 1);

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      await api.put('/company-profile', { ...form, completed: true });
      localStorage.setItem('sentinel_onboarding_done', '1');
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  };

  const steps = [
    <Step1 key={1} form={form} setForm={setForm} />,
    <Step2 key={2} form={form} setForm={setForm} />,
    <Step3 key={3} form={form} setForm={setForm} />,
    <Step4 key={4} form={form} setForm={setForm} />,
    <Step5 key={5} form={form} setForm={setForm} />,
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src={sentinelLogo} alt="Sentinel" className="h-7 w-auto" />
            <span className="text-xs px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium uppercase tracking-wider">
              Setup
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Skip for now →
          </button>
        </div>

        <StepIndicator current={step} />

        {/* Step content */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7 min-h-[420px] flex flex-col">
          <div className="flex-1">
            {steps[step - 1]}
          </div>

          {error && (
            <p className="text-sm text-red-400 mt-4">{error}</p>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-800">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="text-sm text-gray-500 hover:text-gray-300 disabled:opacity-0 transition-colors"
            >
              ← Back
            </button>
            <div className="flex items-center gap-3">
              {step < TOTAL_STEPS ? (
                <button
                  onClick={handleNext}
                  className="btn-primary px-6 py-2.5 text-sm"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="btn-primary px-6 py-2.5 text-sm disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Finish setup →'}
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-700 mt-4">
          You can edit all of this later in Admin → Company Profile
        </p>
      </div>
    </div>
  );
}
