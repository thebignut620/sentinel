import { useState } from 'react';
import sentinelLogo from '../assets/sentinel_logo.png';
import { useAuth } from '../contexts/AuthContext.jsx';

const STEPS = [
  {
    icon: '🛡',
    title: 'Welcome to Sentinel',
    body: 'Your IT helpdesk, reimagined. Fast, intelligent, and built around your workflow.',
  },
  {
    icon: '🤖',
    title: 'AI-Powered Support',
    body: 'Describe any IT issue and our AI will attempt to solve it instantly — before escalating to a ticket.',
  },
  {
    icon: '📋',
    title: 'Track Every Issue',
    body: 'Submit tickets, monitor their status in real time, and communicate directly with IT staff.',
  },
  {
    icon: '⚡',
    title: 'You\'re all set!',
    body: 'Head to your dashboard to get started. IT support is just a click away.',
  },
];

export default function WelcomeModal({ onClose }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="card w-full max-w-md p-8 animate-fadeInScale relative overflow-hidden">
        {/* Pine glow top border */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-pine-500 to-transparent" />

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={sentinelLogo} alt="Sentinel" className="h-10 w-auto opacity-90" />
        </div>

        {/* Step content */}
        <div className="text-center space-y-3 min-h-[120px]" key={step}>
          <div className="text-5xl animate-fadeInScale">{current.icon}</div>
          <h2 className="text-xl font-bold text-white">{current.title}</h2>
          <p className="text-gray-400 text-sm leading-relaxed">{current.body}</p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mt-6 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-6 bg-pine-500' : 'w-1.5 bg-gray-700'
            }`} />
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!isLast && (
            <button onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">
              Skip
            </button>
          )}
          <button
            onClick={isLast ? onClose : () => setStep(s => s + 1)}
            className="btn-primary flex-1 py-2.5 text-sm"
          >
            {isLast ? `Let's go →` : 'Next'}
          </button>
        </div>

        {/* Greeting */}
        {user?.name && (
          <p className="text-center text-xs text-gray-600 mt-4">Logged in as {user.name}</p>
        )}
      </div>
    </div>
  );
}
