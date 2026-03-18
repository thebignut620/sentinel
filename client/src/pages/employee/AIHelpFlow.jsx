import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext.jsx';
import SmartTextarea from '../../components/SmartTextarea.jsx';
import SpinnerButton from '../../components/SpinnerButton.jsx';
import api from '../../api/client.js';

const STEPS = { INPUT: 'input', THINKING: 'thinking', SOLUTION: 'solution', KB: 'kb', TICKET: 'ticket', DONE: 'done' };
const CATEGORY_ICONS = { hardware:'🖥', software:'💾', network:'🌐', access:'🔑', account:'👤' };

function KBSuggestion({ article, onDismiss }) {
  const steps = article.steps
    ? (typeof article.steps === 'string' ? JSON.parse(article.steps) : article.steps)
    : [];

  return (
    <div className="card border-pine-800/40 p-5 animate-fadeIn">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-lg">{CATEGORY_ICONS[article.category] || '📄'}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pine-900/60 text-pine-400 border border-pine-800/50 font-medium">
              ATLAS KB
            </span>
            <span className="text-[10px] text-gray-600 capitalize">{article.category}</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-200">{article.title}</h4>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{article.problem}</p>
      {steps.length > 0 && (
        <ol className="space-y-1.5 mb-3">
          {steps.slice(0, 3).map((s, i) => (
            <li key={i} className="flex gap-2 text-xs text-gray-400">
              <span className="h-4 w-4 rounded-full bg-pine-900/50 text-pine-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
          {steps.length > 3 && (
            <li className="text-[10px] text-gray-600 ml-6">+{steps.length - 3} more steps…</li>
          )}
        </ol>
      )}
    </div>
  );
}

export default function AIHelpFlow() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [step, setStep] = useState(STEPS.INPUT);
  const [problem, setProblem] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [kbArticles, setKbArticles] = useState([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [ticketForm, setTicketForm] = useState({ title: '', priority: 'medium', category: 'software' });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState(null);
  const [error, setError] = useState('');

  const handleAskAI = async () => {
    if (!problem.trim()) return;
    setStep(STEPS.THINKING);
    setError('');
    try {
      const res = await api.post('/ai/assist', { problem });
      console.log('[ATLAS frontend] raw response:', res.data);
      console.log('[ATLAS frontend] suggestion type:', typeof res.data.suggestion, '| length:', res.data.suggestion?.length ?? 'null');
      console.log('[ATLAS frontend] suggestion preview:', res.data.suggestion?.slice(0, 150));
      setAiResult(res.data);
      setStep(STEPS.SOLUTION);
    } catch (err) {
      console.error('[ATLAS frontend] request failed:', err.message, err.response?.data);
      setAiResult({ resolved: false, suggestion: null });
      setError(err.response?.data?.error || 'ATLAS is temporarily offline. You can still submit a ticket below.');
      setStep(STEPS.SOLUTION);
    }
  };

  const handleNeedHelp = async () => {
    setTicketForm({ title: '', priority: 'medium', category: 'software' });
    // Fetch KB suggestions before showing ticket form
    setKbLoading(true);
    setStep(STEPS.KB);
    try {
      const res = await api.get(`/knowledge-base?q=${encodeURIComponent(problem.trim().slice(0, 120))}`);
      setKbArticles(res.data.slice(0, 3));
    } catch {
      setKbArticles([]);
    }
    setKbLoading(false);
  };

  const handleCreateTicket = async () => {
    if (!ticketForm.title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/tickets', {
        title: ticketForm.title,
        description: problem,
        priority: ticketForm.priority,
        category: ticketForm.category,
        ai_attempted: true,
        ai_suggestion: aiResult?.suggestion || null,
      });
      setCreatedTicketId(res.data.id);
      setSubmitSuccess(true);
      setTimeout(() => { setSubmitSuccess(false); setStep(STEPS.DONE); }, 800);
      addToast(`Ticket #${res.data.id} created!`, 'success');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create ticket');
      addToast('Failed to create ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5 animate-fadeIn">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-white">Get IT Help</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium uppercase tracking-wider">
            ATLAS
          </span>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          Describe your issue — ATLAS will diagnose it first.
        </p>
      </div>

      {/* Problem input */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          What IT issue are you experiencing?
        </label>
        <SmartTextarea
          value={problem}
          onChange={e => setProblem(e.target.value)}
          rows={5}
          disabled={step !== STEPS.INPUT}
          className="disabled:opacity-60"
          placeholder="e.g. My VPN keeps disconnecting after the latest Windows update…"
          maxLength={2000}
        />
        {step === STEPS.INPUT && (
          <SpinnerButton
            onClick={handleAskAI}
            disabled={!problem.trim()}
            className="btn-primary mt-3 px-5 py-2.5 text-sm"
          >
            Ask ATLAS →
          </SpinnerButton>
        )}
      </div>

      {/* Thinking */}
      {step === STEPS.THINKING && (
        <div className="card border-pine-900/40 p-6 flex items-center gap-4 animate-fadeIn">
          <div className="h-8 w-8 border-2 border-pine-700 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="font-medium text-pine-300">ATLAS is analyzing your issue…</p>
            <p className="text-sm text-gray-500 mt-0.5">Diagnosing root cause and searching the knowledge base.</p>
          </div>
        </div>
      )}

      {/* AI solution */}
      {step === STEPS.SOLUTION && (
        <>
          <div className="card border-pine-800/50 p-6 animate-fadeIn">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-full bg-pine-900/60 border border-pine-800/50 flex items-center justify-center text-xs font-bold text-pine-300">A</div>
              <span className="font-semibold text-pine-300">ATLAS Diagnosis</span>
            </div>

            {aiResult?.suggestion ? (
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {aiResult.suggestion}
              </div>
            ) : aiResult?.aiDisabled ? (
              <p className="text-sm text-gray-400">AI assistance is currently disabled. Submit a ticket below and the IT team will help you directly.</p>
            ) : error ? (
              <div>
                <p className="text-sm text-amber-300 font-medium mb-1">ATLAS is temporarily unavailable</p>
                <p className="text-sm text-gray-500">{error}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">ATLAS returned an empty response. Please try again or submit a ticket below.</p>
            )}
          </div>

          <div className="card p-6">
            <p className="font-medium text-gray-200 mb-4">Did this solve your problem?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { addToast('Issue resolved. Logged by ATLAS.', 'success'); navigate('/my-tickets'); }}
                className="flex-1 bg-pine-800/60 hover:bg-pine-700/60 border border-pine-700/50 text-pine-300 px-4 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95"
              >
                ✓ Yes, resolved!
              </button>
              <button onClick={handleNeedHelp} className="btn-secondary flex-1 px-4 py-2.5 text-sm">
                ✗ Still need help
              </button>
            </div>
          </div>
        </>
      )}

      {/* KB suggestions step */}
      {step === STEPS.KB && (
        <div className="space-y-4 animate-fadeIn">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-200">ATLAS Knowledge Base</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pine-900/60 text-pine-400 border border-pine-800/50">Auto-search</span>
            </div>
            <p className="text-xs text-gray-500">Checking past resolutions for your issue…</p>
          </div>

          {kbLoading ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
            </div>
          ) : kbArticles.length > 0 ? (
            <>
              <p className="text-xs text-gray-500 px-1">ATLAS found {kbArticles.length} similar resolution{kbArticles.length !== 1 ? 's' : ''}:</p>
              {kbArticles.map(a => <KBSuggestion key={a.id} article={a} />)}
              <div className="card p-5">
                <p className="text-sm font-medium text-gray-300 mb-3">Did any of these solve your issue?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { addToast('Marked as resolved via KB.', 'success'); navigate('/my-tickets'); }}
                    className="flex-1 bg-pine-800/60 hover:bg-pine-700/60 border border-pine-700/50 text-pine-300 px-4 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95"
                  >
                    ✓ Fixed it!
                  </button>
                  <button
                    onClick={() => setStep(STEPS.TICKET)}
                    className="btn-secondary flex-1 px-4 py-2.5 text-sm"
                  >
                    Still need a ticket
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-5 border-amber-900/30">
              <p className="text-sm text-amber-300 mb-1">No matching articles found</p>
              <p className="text-xs text-gray-500 mb-4">ATLAS will create one automatically when your ticket is resolved.</p>
              <button onClick={() => setStep(STEPS.TICKET)} className="btn-primary px-5 py-2.5 text-sm">
                Submit a Ticket →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create ticket form */}
      {step === STEPS.TICKET && (
        <div className="card p-6 animate-fadeIn">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-semibold text-gray-200">Create a Support Ticket</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/60 text-purple-400 border border-purple-800/50">
              ATLAS auto-categorizes
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-5">ATLAS will set category and priority automatically.</p>

          {error && (
            <div className="bg-red-900/40 border border-red-800/50 text-red-300 px-3 py-2 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Ticket title</label>
              <input
                type="text"
                value={ticketForm.title}
                onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                className="input w-full"
                placeholder="Brief summary of your issue"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Priority</label>
                <select
                  value={ticketForm.priority}
                  onChange={e => setTicketForm(f => ({ ...f, priority: e.target.value }))}
                  className="input w-full"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Category</label>
                <select
                  value={ticketForm.category}
                  onChange={e => setTicketForm(f => ({ ...f, category: e.target.value }))}
                  className="input w-full"
                >
                  <option value="hardware">🖥 Hardware</option>
                  <option value="software">💾 Software</option>
                  <option value="network">🌐 Network</option>
                  <option value="access">🔑 Access</option>
                  <option value="account">👤 Account</option>
                </select>
              </div>
            </div>

            <p className="text-[11px] text-gray-600 -mt-1">
              ATLAS will override these with AI-detected values on submission.
            </p>

            <div className="flex gap-3 pt-1">
              <SpinnerButton
                onClick={handleCreateTicket}
                disabled={!ticketForm.title.trim() || submitting}
                loading={submitting}
                success={submitSuccess}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                Submit Ticket
              </SpinnerButton>
              <button
                onClick={() => setStep(STEPS.KB)}
                className="btn-secondary px-4 py-2.5 text-sm"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Done */}
      {step === STEPS.DONE && (
        <div className="card border-pine-800/50 p-8 text-center animate-fadeIn">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-semibold text-pine-300 mb-1">Ticket Created!</h2>
          <p className="text-sm text-gray-500 mb-2">
            Ticket #{createdTicketId} submitted. ATLAS has auto-categorized and assigned it.
          </p>
          <p className="text-xs text-gray-600 mb-6">
            Our IT team will be in touch soon.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(`/tickets/${createdTicketId}`)}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              View Ticket
            </button>
            <button
              onClick={() => { setProblem(''); setAiResult(null); setError(''); setKbArticles([]); setStep(STEPS.INPUT); }}
              className="btn-secondary px-5 py-2.5 text-sm"
            >
              Report Another Issue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
