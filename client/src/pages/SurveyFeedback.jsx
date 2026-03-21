import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';

export default function SurveyFeedback() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();

  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(searchParams.get('rating') || '');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/analytics/satisfaction/${token}`)
      .then(r => {
        setSurvey(r.data);
        // If already submitted, show the done state
        if (r.data.rating) setSubmitted(true);
      })
      .catch(() => setError('This survey link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (selectedRating) => {
    if (submitting) return;
    const finalRating = selectedRating || rating;
    if (!finalRating) return;
    setSubmitting(true);
    try {
      await api.post(`/analytics/satisfaction/${token}`, {
        rating: finalRating,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
      setRating(finalRating);
    } catch (e) {
      if (e.response?.status === 409) {
        setSubmitted(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-pine-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-white mb-2">Link Not Found</h1>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const wasPositive = (survey?.rating || rating) === 'up';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">{wasPositive ? '🎉' : '🙏'}</div>
          <h1 className="text-2xl font-bold text-white mb-3">
            {wasPositive ? 'Glad we could help!' : 'Thank you for your feedback'}
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            {wasPositive
              ? 'Your positive feedback means a lot to our IT team. We\'ll keep up the great work!'
              : 'We\'re sorry we didn\'t fully meet your expectations. Your feedback helps us improve.'}
          </p>
          <div className="mt-6 bg-gray-800/60 rounded-xl p-4">
            <p className="text-gray-500 text-xs">Feedback submitted for:</p>
            <p className="text-gray-200 text-sm font-medium mt-1">{survey?.ticket_title}</p>
          </div>
          <p className="text-gray-600 text-xs mt-6">You can close this tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="max-w-lg w-full">
        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 to-pine-950/50 border-b border-gray-800 px-8 py-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-2 w-2 rounded-full bg-pine-500" />
              <span className="text-pine-400 text-xs font-semibold uppercase tracking-widest">
                Sentinel IT
              </span>
            </div>
            <h1 className="text-xl font-bold text-white">How did we do?</h1>
          </div>

          <div className="px-8 py-7">
            {/* Ticket reference */}
            <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
              <p className="text-gray-500 text-xs mb-1">Your resolved ticket:</p>
              <p className="text-gray-200 font-medium">{survey?.ticket_title}</p>
            </div>

            <p className="text-gray-300 text-sm mb-5">
              Was your issue resolved to your satisfaction?
            </p>

            {/* Thumbs buttons */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => { setRating('up'); }}
                className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-xl border-2 transition-all ${
                  rating === 'up'
                    ? 'border-pine-500 bg-pine-900/40 scale-105'
                    : 'border-gray-700 hover:border-pine-700 hover:bg-pine-900/20'
                }`}
              >
                <span className="text-4xl">👍</span>
                <span className={`text-sm font-medium ${rating === 'up' ? 'text-pine-300' : 'text-gray-400'}`}>
                  Yes, resolved!
                </span>
              </button>

              <button
                onClick={() => { setRating('down'); }}
                className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-xl border-2 transition-all ${
                  rating === 'down'
                    ? 'border-red-500 bg-red-900/30 scale-105'
                    : 'border-gray-700 hover:border-red-800 hover:bg-red-900/10'
                }`}
              >
                <span className="text-4xl">👎</span>
                <span className={`text-sm font-medium ${rating === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
                  Not quite
                </span>
              </button>
            </div>

            {/* Optional comment */}
            {rating && (
              <div className="mb-5 animate-in fade-in duration-200">
                <label className="text-gray-400 text-xs block mb-2">
                  {rating === 'down'
                    ? 'What could we have done better? (optional)'
                    : 'Any comments? (optional)'}
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  placeholder="Share your thoughts..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-pine-600 resize-none"
                />
              </div>
            )}

            {/* Submit */}
            <button
              onClick={() => submit(rating)}
              disabled={!rating || submitting}
              className="w-full py-3 bg-pine-700 hover:bg-pine-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Feedback'}
            </button>

            {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}
          </div>
        </div>

        <p className="text-gray-700 text-xs text-center mt-4">
          Sentinel IT Helpdesk · Powered by ATLAS AI
        </p>
      </div>
    </div>
  );
}
