import { Link } from 'react-router-dom';

const APP_VERSION = '1.0.0';

export default function AppFooter() {
  return (
    <footer className="hidden md:flex items-center justify-between px-6 py-2 border-t border-gray-800/60 bg-gray-950 shrink-0">
      <span className="text-gray-700 text-xs font-mono">
        Sentinel v{APP_VERSION}
      </span>
      <div className="flex items-center gap-4">
        <Link
          to="/changelog"
          className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
        >
          Changelog
        </Link>
        <Link
          to="/status"
          className="text-gray-600 hover:text-gray-400 text-xs transition-colors flex items-center gap-1"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Status
        </Link>
        <a
          href="mailto:support@sentinelaiapp.com?subject=Bug%20Report"
          className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
        >
          Report a bug
        </a>
      </div>
    </footer>
  );
}
