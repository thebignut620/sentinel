import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ToastProvider, useToast } from './contexts/ToastContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import AppLoader from './components/AppLoader.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import MaintenanceBanner from './components/MaintenanceBanner.jsx';
import NavProgress from './components/NavProgress.jsx';
import WelcomeModal from './components/WelcomeModal.jsx';
import Login from './pages/Login.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import NotFound from './pages/NotFound.jsx';
import KnowledgeBase from './pages/KnowledgeBase.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AIHelpFlow from './pages/employee/AIHelpFlow.jsx';
import MyTickets from './pages/employee/MyTickets.jsx';
import MyProfile from './pages/employee/MyProfile.jsx';
import TicketList from './pages/staff/TicketList.jsx';
import TicketDetail from './pages/staff/TicketDetail.jsx';
import UserManagement from './pages/admin/UserManagement.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';
import OnboardingWizard from './pages/admin/OnboardingWizard.jsx';
import CompanyProfile from './pages/admin/CompanyProfile.jsx';
import Integrations from './pages/admin/Integrations.jsx';
import Departments from './pages/admin/Departments.jsx';
import Assets from './pages/admin/Assets.jsx';
import Maintenance from './pages/admin/Maintenance.jsx';
import CustomFields from './pages/admin/CustomFields.jsx';
import AuditLog from './pages/admin/AuditLog.jsx';
import Permissions from './pages/admin/Permissions.jsx';
import TwoFactorSetup from './pages/admin/TwoFactorSetup.jsx';
import SsoCallback from './pages/SsoCallback.jsx';
import api from './api/client.js';

function RootRedirect() {
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

// Redirects first-time admins to the onboarding wizard
function OnboardingGate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    if (pathname === '/onboarding') return;
    if (localStorage.getItem('sentinel_onboarding_done')) return;

    api.get('/company-profile').then(r => {
      if (!r.data) {
        navigate('/onboarding', { replace: true });
      } else {
        localStorage.setItem('sentinel_onboarding_done', '1');
      }
    }).catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function AppInner() {
  const { loading } = useAuth();
  if (loading) return <AppLoader />;

  return (
    <>
      <MaintenanceBanner />
      <OfflineBanner />
      <NavProgress />
      <WelcomeGate />
      <OnboardingGate />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/sso-callback" element={<SsoCallback />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Onboarding wizard — full screen, no sidebar */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute roles={['admin']}>
              <OnboardingWizard />
            </ProtectedRoute>
          }
        />

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
          <Route path="my-profile" element={<MyProfile />} />
          <Route path="knowledge-base" element={<KnowledgeBase />} />

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
            path="admin/company-profile"
            element={
              <ProtectedRoute roles={['admin']}>
                <CompanyProfile />
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
          <Route
            path="admin/integrations"
            element={
              <ProtectedRoute roles={['admin']}>
                <Integrations />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/departments"
            element={
              <ProtectedRoute roles={['admin']}>
                <Departments />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/assets"
            element={
              <ProtectedRoute roles={['it_staff', 'admin']}>
                <Assets />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/maintenance"
            element={
              <ProtectedRoute roles={['admin']}>
                <Maintenance />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/custom-fields"
            element={
              <ProtectedRoute roles={['admin']}>
                <CustomFields />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/audit-log"
            element={
              <ProtectedRoute roles={['admin']}>
                <AuditLog />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/permissions"
            element={
              <ProtectedRoute roles={['admin']}>
                <Permissions />
              </ProtectedRoute>
            }
          />
          <Route path="settings/2fa" element={<TwoFactorSetup />} />
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
