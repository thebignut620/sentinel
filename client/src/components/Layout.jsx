import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import sentinelLogo from '../assets/sentinel_logo.png';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api/client.js';

const ICONS = {
  dashboard: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  help: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  tickets: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  bell: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  chevronLeft: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  logout: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  kb: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  building: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  person: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

function NavLink({ to, icon, label, collapsed }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to));

  return (
    <div className="relative group">
      <Link
        to={to}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
          ${active
            ? 'bg-pine-800/80 text-pine-200 shadow-[0_0_12px_rgba(74,170,74,0.25)] border border-pine-700/50'
            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
          }`}
      >
        <span className={active ? 'text-pine-300' : ''}>{icon}</span>
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50
                        bg-gray-800 border border-gray-700 text-gray-200 text-xs
                        px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap
                        opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
          {label}
        </div>
      )}
    </div>
  );
}

function Avatar({ name }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className="h-8 w-8 rounded-full bg-pine-700 flex items-center justify-center text-white text-xs font-bold shrink-0 ring-2 ring-pine-600/40">
      {initials}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [openTickets, setOpenTickets] = useState(0);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', collapsed);
  }, [collapsed]);

  // Load open ticket count for bell badge
  useEffect(() => {
    if (user?.role !== 'employee') {
      api.get('/tickets?status=open').then(r => setOpenTickets(r.data.length)).catch(() => {});
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = {
    employee: [
      { to: '/dashboard',       icon: ICONS.dashboard, label: 'Dashboard' },
      { to: '/help',            icon: ICONS.help,      label: 'Get AI Help' },
      { to: '/my-tickets',      icon: ICONS.tickets,   label: 'My Tickets' },
      { to: '/knowledge-base',  icon: ICONS.kb,        label: 'Knowledge Base' },
      { to: '/my-profile',      icon: ICONS.person,    label: 'My Profile' },
    ],
    it_staff: [
      { to: '/dashboard',      icon: ICONS.dashboard, label: 'Dashboard' },
      { to: '/tickets',        icon: ICONS.tickets,   label: 'All Tickets' },
      { to: '/knowledge-base', icon: ICONS.kb,        label: 'Knowledge Base' },
    ],
    admin: [
      { to: '/dashboard',             icon: ICONS.dashboard, label: 'Dashboard' },
      { to: '/tickets',               icon: ICONS.tickets,   label: 'All Tickets' },
      { to: '/knowledge-base',        icon: ICONS.kb,        label: 'Knowledge Base' },
      { to: '/admin/users',           icon: ICONS.users,     label: 'User Management' },
      { to: '/admin/company-profile', icon: ICONS.building,  label: 'Company Profile' },
      { to: '/admin/settings',        icon: ICONS.settings,  label: 'Settings' },
    ],
  };

  const links = navItems[user?.role] || [];

  return (
    <div className="min-h-screen flex bg-gray-950">
      {/* Sidebar */}
      <aside
        className={`flex flex-col shrink-0 bg-gray-900 border-r border-gray-800 transition-all duration-300 ease-in-out
          ${collapsed ? 'w-16' : 'w-56'}`}
      >
        {/* Header */}
        <div className={`flex items-center border-b border-gray-800 h-14 shrink-0 ${collapsed ? 'justify-center px-2' : 'px-4 gap-3'}`}>
          {!collapsed && <img src={sentinelLogo} alt="Sentinel" className="h-7 w-auto" />}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto text-gray-500 hover:text-gray-300 hover:bg-gray-800 p-1.5 rounded-lg transition-all duration-150"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? ICONS.chevronRight : ICONS.chevronLeft}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {links.map(item => (
            <NavLink key={item.to} {...item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Bell + User footer */}
        <div className="p-2 border-t border-gray-800 space-y-1">
          {/* Notification bell (staff/admin) */}
          {user?.role !== 'employee' && (
            <div className="relative group">
              <Link
                to="/tickets?status=open"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-all duration-200 text-sm"
              >
                <span className="relative shrink-0">
                  {ICONS.bell}
                  {openTickets > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {openTickets > 9 ? '9+' : openTickets}
                    </span>
                  )}
                </span>
                {!collapsed && <span>Open Tickets</span>}
              </Link>
              {collapsed && openTickets > 0 && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50
                                bg-gray-800 border border-gray-700 text-gray-200 text-xs
                                px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap
                                opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {openTickets} open ticket{openTickets !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* User info */}
          <div className={`flex items-center gap-2.5 px-2 py-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
            <Avatar name={user?.name} />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            )}
          </div>

          {/* Logout */}
          <div className="relative group">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-500 hover:bg-red-950/60 hover:text-red-400 transition-all duration-200 text-sm ${collapsed ? 'justify-center' : ''}`}
            >
              {ICONS.logout}
              {!collapsed && 'Sign out'}
            </button>
            {collapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50
                              bg-gray-800 border border-gray-700 text-gray-200 text-xs
                              px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap
                              opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Sign out
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
