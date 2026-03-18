import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext.jsx';
import SmartTextarea from '../../components/SmartTextarea.jsx';
import SpinnerButton from '../../components/SpinnerButton.jsx';
import api from '../../api/client.js';

const STEPS = { INPUT: 'input', THINKING: 'thinking', SOLUTION: 'solution', TICKET: 'ticket', DONE: 'done' };

export default function AIHelpFlow() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [step, setStep] = useState(STEPS.INPUT);
  const [problem, setProblem] = useState('');
  const [aiResult, setAiResult] = useState(null);
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
      setAiResult(res.data);
      setStep(STEPS.SOLUTION);
    } catch (err) {
      setAiResult({ resolved: false, suggestion: null });
      setError(err.response?.data?.error || 'AI service unavailable');
      setStep(STEPS.SOLUTION);
    }
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
        <h1 className="text-2xl font-bold text-white">Get IT Help</h1>
        <p className="text-gray-500 text-sm mt-1">
          Describe your issue — our AI will try to solve it first.
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
            Ask AI for Help →
          </SpinnerButton>
        )}
      </div>

      {/* Thinking */}
      {step === STEPS.THINKING && (
        <div className="card border-pine-900/40 p-6 flex items-center gap-4">
          <div className="h-8 w-8 border-2 border-pine-700 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="font-medium text-pine-300">Sentinel AI is analysing your issue…</p>
            <p className="text-sm text-gray-500 mt-0.5">This usually takes a few seconds.</p>
          </div>
        </div>
      )}

      {/* AI solution */}
      {step === STEPS.SOLUTION && (
        <>
          {aiResult?.suggestion ? (
            <div className="card border-pine-800/50 p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <span className="font-semibold text-pine-300">AI Suggested Solution</span>
              </div>
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {aiResult.suggestion}
              </div>
            </div>
          ) : (
            <div className="card border-amber-800/50 p-5">
              <p className="font-medium text-amber-300 mb-1">AI was unable to provide a solution</p>
              <p className="text-sm text-gray-500">{error || 'This issue may require hands-on support.'}</p>
            </div>
          )}

          <div className="card p-6">
            <p className="font-medium text-gray-200 mb-4">Did this solve your problem?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { addToast('Great! Issue resolved.', 'success'); navigate('/my-tickets'); }}
                className="flex-1 bg-pine-800/60 hover:bg-pine-700/60 border border-pine-700/50 text-pine-300 px-4 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95"
              >
                ✓ Yes, resolved!
              </button>
              <button
                onClick={() => { setTicketForm({ title: '', priority: 'medium', category: 'software' }); setStep(STEPS.TICKET); }}
                className="btn-secondary flex-1 px-4 py-2.5 text-sm"
              >
                ✗ Still need help
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create ticket form */}
      {step === STEPS.TICKET && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-200 mb-1">Create a Support Ticket</h2>
          <p className="text-sm text-gray-500 mb-5">Our IT team will review and get back to you soon.</p>

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
                  <option value="low">Low — minor inconvenience</option>
                  <option value="medium">Medium — affecting work</option>
                  <option value="high">High — blocking work</option>
                  <option value="critical">Critical — system down</option>
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
                onClick={() => setStep(STEPS.SOLUTION)}
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
        <div className="card border-pine-800/50 p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-semibold text-pine-300 mb-1">Ticket Created!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Ticket #{createdTicketId} submitted. Our IT team will be in touch soon.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(`/tickets/${createdTicketId}`)}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              View Ticket
            </button>
            <button
              onClick={() => { setProblem(''); setAiResult(null); setError(''); setStep(STEPS.INPUT); }}
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
