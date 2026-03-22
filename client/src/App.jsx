import { useState, useEffect, lazy, Suspense } from 'react';
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

// Eagerly loaded — core pages users hit immediately
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NotFound from './pages/NotFound.jsx';

// Lazily loaded — reduces initial bundle size
const Signup = lazy(() => import('./pages/Signup.jsx'));
const Pricing = lazy(() => import('./pages/Pricing.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const StatusPage = lazy(() => import('./pages/StatusPage.jsx'));
const Changelog = lazy(() => import('./pages/Changelog.jsx'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase.jsx'));
const AIHelpFlow = lazy(() => import('./pages/employee/AIHelpFlow.jsx'));
const MyTickets = lazy(() => import('./pages/employee/MyTickets.jsx'));
const MyProfile = lazy(() => import('./pages/employee/MyProfile.jsx'));
const TicketList = lazy(() => import('./pages/staff/TicketList.jsx'));
const TicketDetail = lazy(() => import('./pages/staff/TicketDetail.jsx'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings.jsx'));
const OnboardingWizard = lazy(() => import('./pages/admin/OnboardingWizard.jsx'));
const CompanyProfile = lazy(() => import('./pages/admin/CompanyProfile.jsx'));
const Integrations = lazy(() => import('./pages/admin/Integrations.jsx'));
const Departments = lazy(() => import('./pages/admin/Departments.jsx'));
const Assets = lazy(() => import('./pages/admin/Assets.jsx'));
const Maintenance = lazy(() => import('./pages/admin/Maintenance.jsx'));
const CustomFields = lazy(() => import('./pages/admin/CustomFields.jsx'));
const AuditLog = lazy(() => import('./pages/admin/AuditLog.jsx'));
const Permissions = lazy(() => import('./pages/admin/Permissions.jsx'));
const TwoFactorSetup = lazy(() => import('./pages/admin/TwoFactorSetup.jsx'));
const SsoCallback = lazy(() => import('./pages/SsoCallback.jsx'));
const ApiKeys = lazy(() => import('./pages/admin/ApiKeys.jsx'));
const ApiDocs = lazy(() => import('./pages/ApiDocs.jsx'));
const Analytics = lazy(() => import('./pages/admin/Analytics.jsx'));
const SurveyFeedback = lazy(() => import('./pages/SurveyFeedback.jsx'));
const Templates = lazy(() => import('./pages/admin/Templates.jsx'));
const Clusters = lazy(() => import('./pages/admin/Clusters.jsx'));
const Billing = lazy(() => import('./pages/admin/Billing.jsx'));
const NotificationPreferences = lazy(() => import('./pages/NotificationPreferences.jsx'));

import api from './api/client.js';

// Root: Landing for guests, redirect to dashboard for authenticated users
function LandingOrDashboard() {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
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
      <Suspense fallback={<AppLoader />}>
      <Routes>
        {/* Root: Landing for guests */}
        <Route path="/" element={<LandingOrDashboard />} />

        {/* Public pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/sso-callback" element={<SsoCallback />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/api-docs" element={<ApiDocs />} />
        <Route path="/survey/:token" element={<SurveyFeedback />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/changelog" element={<Changelog />} />

        {/* Onboarding wizard — full screen, no sidebar */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute roles={['admin']}>
              <OnboardingWizard />
            </ProtectedRoute>
          }
        />

        {/* Protected app routes with Layout sidebar */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
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
          <Route path="admin/users"           element={<ProtectedRoute roles={['admin']}><UserManagement /></ProtectedRoute>} />
          <Route path="admin/company-profile" element={<ProtectedRoute roles={['admin']}><CompanyProfile /></ProtectedRoute>} />
          <Route path="admin/settings"        element={<ProtectedRoute roles={['admin']}><AdminSettings /></ProtectedRoute>} />
          <Route path="admin/integrations"    element={<ProtectedRoute roles={['admin']}><Integrations /></ProtectedRoute>} />
          <Route path="admin/departments"     element={<ProtectedRoute roles={['admin']}><Departments /></ProtectedRoute>} />
          <Route path="admin/assets"          element={<ProtectedRoute roles={['it_staff', 'admin']}><Assets /></ProtectedRoute>} />
          <Route path="admin/maintenance"     element={<ProtectedRoute roles={['admin']}><Maintenance /></ProtectedRoute>} />
          <Route path="admin/custom-fields"   element={<ProtectedRoute roles={['admin']}><CustomFields /></ProtectedRoute>} />
          <Route path="admin/audit-log"       element={<ProtectedRoute roles={['admin']}><AuditLog /></ProtectedRoute>} />
          <Route path="admin/permissions"     element={<ProtectedRoute roles={['admin']}><Permissions /></ProtectedRoute>} />
          <Route path="admin/api-keys"        element={<ProtectedRoute roles={['admin']}><ApiKeys /></ProtectedRoute>} />
          <Route path="admin/analytics"       element={<ProtectedRoute roles={['admin', 'it_staff']}><Analytics /></ProtectedRoute>} />
          <Route path="admin/templates"       element={<ProtectedRoute roles={['admin', 'it_staff']}><Templates /></ProtectedRoute>} />
          <Route path="admin/clusters"        element={<ProtectedRoute roles={['admin', 'it_staff']}><Clusters /></ProtectedRoute>} />
          <Route path="admin/billing"         element={<ProtectedRoute roles={['admin']}><Billing /></ProtectedRoute>} />
          <Route path="settings/2fa"          element={<TwoFactorSetup />} />
          <Route path="notification-preferences" element={<NotificationPreferences />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          {/* Accessibility: skip to main content */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-pine-700 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
          >
            Skip to main content
          </a>
          <SessionWatcher />
          <AppInner />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
