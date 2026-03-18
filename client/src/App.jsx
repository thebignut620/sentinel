import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ToastProvider, useToast } from './contexts/ToastContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import AppLoader from './components/AppLoader.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import NavProgress from './components/NavProgress.jsx';
import WelcomeModal from './components/WelcomeModal.jsx';
import Login from './pages/Login.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import NotFound from './pages/NotFound.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AIHelpFlow from './pages/employee/AIHelpFlow.jsx';
import MyTickets from './pages/employee/MyTickets.jsx';
import TicketList from './pages/staff/TicketList.jsx';
import TicketDetail from './pages/staff/TicketDetail.jsx';
import UserManagement from './pages/admin/UserManagement.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to="/dashboard" replace />;
}

// Handles the session-expired event fired by the API client
function SessionWatcher() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { logout } = useAuth();

  useEffect(() => {
    const handler = () => {
      logout();
      addToast('Your session has expired. Please sign in again.', 'warning');
      navigate('/login', { replace: true });
    };
    window.addEventListener('sentinel:session-expired', handler);
    return () => window.removeEventListener('sentinel:session-expired', handler);
  }, [navigate, addToast, logout]);

  return null;
}

// Welcome modal: shown once per device after first login
function WelcomeGate() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user?._isNew) setShow(true);
  }, [user]);

  const dismiss = () => {
    localStorage.setItem('sentinel_welcomed', '1');
    setShow(false);
  };

  if (!show) return null;
  return <WelcomeModal onClose={dismiss} />;
}

function AppInner() {
  const { loading } = useAuth();
  if (loading) return <AppLoader />;

  return (
    <>
      <OfflineBanner />
      <NavProgress />
      <WelcomeGate />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RootRedirect />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Employee */}
          <Route path="help" element={<AIHelpFlow />} />
          <Route path="my-tickets" element={<MyTickets />} />

          {/* Staff + Admin */}
          <Route
            path="tickets"
            element={
              <ProtectedRoute roles={['it_staff', 'admin']}>
                <TicketList />
              </ProtectedRoute>
            }
          />
          <Route path="tickets/:id" element={<TicketDetail />} />

          {/* Admin only */}
          <Route
            path="admin/users"
            element={
              <ProtectedRoute roles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/settings"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <SessionWatcher />
          <AppInner />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
