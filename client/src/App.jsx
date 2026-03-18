import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
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

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
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

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
