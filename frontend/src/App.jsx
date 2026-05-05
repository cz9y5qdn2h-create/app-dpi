import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthProvider from './context/AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import LegalPage from './pages/LegalPage';
import DashboardPage from './pages/DashboardPage';
import DIPPage from './pages/DIPPage';
import UploadDIPPage from './pages/UploadDIPPage';
import GenerateDIPPage from './pages/GenerateDIPPage';
import AlertsPage from './pages/AlertsPage';
import HistoryPage from './pages/HistoryPage';
import FranchiseesPage from './pages/FranchiseesPage';
import SettingsPage from './pages/SettingsPage';
import ExportPage from './pages/ExportPage';
import AdminPage from './pages/AdminPage';
import ApiConfigPage from './pages/ApiConfigPage';
import LoadingSpinner from './components/ui/LoadingSpinner';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg-primary"><LoadingSpinner size="lg" /></div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg-primary"><LoadingSpinner size="lg" /></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg-primary"><LoadingSpinner size="lg" /></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Landing page publique */}
        <Route path="/" element={<RootRedirect />} />

        {/* Pages légales (publiques) */}
        <Route path="/cgu" element={<LegalPage />} />
        <Route path="/privacy" element={<LegalPage />} />
        <Route path="/mentions-legales" element={<LegalPage />} />

        {/* Auth (redirige si déjà connecté) */}
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

        {/* Pages protégées */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="dip" element={<ErrorBoundary><DIPPage /></ErrorBoundary>} />
          <Route path="dip/upload" element={<ErrorBoundary><UploadDIPPage /></ErrorBoundary>} />
          <Route path="dip/generate" element={<ErrorBoundary><GenerateDIPPage /></ErrorBoundary>} />
          <Route path="alerts" element={<ErrorBoundary><AlertsPage /></ErrorBoundary>} />
          <Route path="history" element={<ErrorBoundary><HistoryPage /></ErrorBoundary>} />
          <Route path="franchisees" element={<ErrorBoundary><FranchiseesPage /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
          <Route path="export" element={<ErrorBoundary><ExportPage /></ErrorBoundary>} />
          <Route path="admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
          <Route path="integrations" element={<ErrorBoundary><ApiConfigPage /></ErrorBoundary>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
