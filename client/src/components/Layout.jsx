import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import sentinelLogo from '../assets/sentinel_logo.png';
import { useAuth } from '../contexts/AuthContext.jsx';

function NavLink({ to, children }) {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(to + '/');
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-pine-800 text-white'
          : 'text-pine-100 hover:bg-pine-800/60'
      }`}
    >
      {children}
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-pine-900 flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-pine-800">
          <img src={sentinelLogo} alt="Sentinel" className="h-8 w-auto" />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {/* Employee nav */}
          {user?.role === 'employee' && (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/help">Get AI Help</NavLink>
              <NavLink to="/my-tickets">My Tickets</NavLink>
            </>
          )}

          {/* IT Staff nav */}
          {user?.role === 'it_staff' && (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/tickets">All Tickets</NavLink>
            </>
          )}

          {/* Admin nav */}
          {user?.role === 'admin' && (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/tickets">All Tickets</NavLink>
              <NavLink to="/admin/users">User Management</NavLink>
              <NavLink to="/admin/settings">Settings</NavLink>
            </>
          )}
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-pine-800">
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-pine-300 text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-pine-200 hover:text-white hover:bg-pine-800 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
