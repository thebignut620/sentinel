import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client.js';

const STEPS = { INPUT: 'input', THINKING: 'thinking', SOLUTION: 'solution', TICKET: 'ticket', DONE: 'done' };

export default function AIHelpFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEPS.INPUT);
  const [problem, setProblem] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [ticketForm, setTicketForm] = useState({ title: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);
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
        ai_attempted: true,
        ai_suggestion: aiResult?.suggestion || null,
      });
      setCreatedTicketId(res.data.id);
      setStep(STEPS.DONE);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Get IT Help</h1>
        <p className="text-gray-500 text-sm mt-1">
          Describe your issue below — our AI will try to solve it for you first.
        </p>
      </div>

      {/* Step 1: Problem input */}
      <div className="bg-white rounded-xl border p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What IT issue are you experiencing?
        </label>
        <textarea
          value={problem}
          onChange={e => setProblem(e.target.value)}
          rows={5}
          disabled={step !== STEPS.INPUT}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pine-700 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
          placeholder="e.g. My VPN keeps disconnecting after the latest Windows update. I've tried restarting but it still happens."
        />
        {step === STEPS.INPUT && (
          <button
            onClick={handleAskAI}
            disabled={!problem.trim()}
            className="mt-3 bg-pine-900 hover:bg-pine-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Ask AI for Help →
          </button>
        )}
      </div>

      {/* Step 2: Thinking */}
      {step === STEPS.THINKING && (
        <div className="bg-pine-50 border border-pine-200 rounded-xl p-6 flex items-center gap-4">
          <div className="animate-spin h-6 w-6 border-2 border-pine-700 border-t-transparent rounded-full shrink-0" />
          <div>
            <p className="font-medium text-pine-900">Sentinel AI is analysing your issue…</p>
            <p className="text-sm text-pine-700 mt-0.5">This usually takes a few seconds.</p>
          </div>
        </div>
      )}

      {/* Step 3: AI Solution */}
      {step === STEPS.SOLUTION && (
        <>
          {aiResult?.suggestion ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <span className="font-semibold text-emerald-900">AI Suggested Solution</span>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {aiResult.suggestion}
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <p className="font-medium text-amber-900 mb-1">AI was unable to provide a solution</p>
              <p className="text-sm text-amber-700">
                {error || 'This issue may require hands-on support from our IT team.'}
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl border p-6">
            <p className="font-medium text-gray-900 mb-4">Did this solve your problem?</p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/my-tickets')}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                ✓ Yes, it's resolved!
              </button>
              <button
                onClick={() => {
                  setTicketForm({ title: '', priority: 'medium' });
                  setStep(STEPS.TICKET);
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                ✗ Still need help
              </button>
            </div>
          </div>
        </>
      )}

      {/* Step 4: Create Ticket */}
      {step === STEPS.TICKET && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Create a Support Ticket</h2>
          <p className="text-sm text-gray-500 mb-5">
            Our IT team will review your ticket and get back to you as soon as possible.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ticket title</label>
              <input
                type="text"
                value={ticketForm.title}
                onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pine-700"
                placeholder="Brief summary of your issue"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={ticketForm.priority}
                onChange={e => setTicketForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pine-700"
              >
                <option value="low">Low — minor inconvenience</option>
                <option value="medium">Medium — affecting my work</option>
                <option value="high">High — blocking my work</option>
                <option value="critical">Critical — system down</option>
              </select>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleCreateTicket}
                disabled={!ticketForm.title.trim() || submitting}
                className="bg-pine-900 hover:bg-pine-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit Ticket'}
              </button>
              <button
                onClick={() => setStep(STEPS.SOLUTION)}
                className="text-gray-600 hover:text-gray-800 px-4 py-2.5 rounded-lg text-sm"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Done */}
      {step === STEPS.DONE && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-semibold text-green-900 mb-1">Ticket Created!</h2>
          <p className="text-sm text-green-700 mb-5">
            Ticket #{createdTicketId} has been submitted. Our IT team will be in touch soon.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(`/tickets/${createdTicketId}`)}
              className="bg-green-700 hover:bg-green-800 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >
              View Ticket
            </button>
            <button
              onClick={() => {
                setProblem('');
                setAiResult(null);
                setError('');
                setStep(STEPS.INPUT);
              }}
              className="bg-white border border-green-300 text-green-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-50"
            >
              Report Another Issue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
