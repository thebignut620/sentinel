import { Link } from 'react-router-dom';
import sentinelLogo from '../assets/sentinel_logo.png';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8 animate-fadeIn">
      {/* Dot grid */}
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" />

      <div className="relative text-center space-y-6 max-w-md">
        {/* Logo with dim glow */}
        <img
          src={sentinelLogo}
          alt="Sentinel"
          className="h-14 w-auto mx-auto opacity-40"
          style={{ filter: 'drop-shadow(0 0 20px rgba(74,170,74,0.2))' }}
        />

        {/* 404 */}
        <div className="font-heading font-bold text-[7rem] leading-none text-gray-800 select-none">
          404
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-300">This page has gone dark.</h1>
          <p className="text-gray-600 text-sm">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-gray-700 to-transparent" />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/dashboard" className="btn-primary px-6 py-2.5 text-sm">
            ← Back to Dashboard
          </Link>
          <Link to="/help" className="btn-secondary px-6 py-2.5 text-sm">
            Get IT Help
          </Link>
        </div>

        {/* Status indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-700">
          <span className="h-1.5 w-1.5 rounded-full bg-pine-800 animate-pulse" />
          Sentinel is running normally
        </div>
      </div>
    </div>
  );
}
