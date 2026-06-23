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
import ContractPage from './pages/ContractPage';
import UploadContractPage from './pages/UploadContractPage';
import GenerateContractPage from './pages/GenerateContractPage';
import SharedContractPage from './pages/SharedContractPage';
import AlertsPage from './pages/AlertsPage';
import HistoryPage from './pages/HistoryPage';
import FranchiseesPage from './pages/FranchiseesPage';
import SettingsPage from './pages/SettingsPage';
import ExportPage from './pages/ExportPage';
import AdminPage from './pages/AdminPage';
import ApiConfigPage from './pages/ApiConfigPage';
import MonitorPage from './pages/MonitorPage';
import DocMonitoringPage from './pages/DocMonitoringPage';
import TrialExpiredPage from './pages/TrialExpiredPage';
import WaitlistPage from './pages/WaitlistPage';
import SharedDIPPage from './pages/SharedDIPPage';
import AnalyticsPage from './pages/AnalyticsPage';
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

function TrialGuard({ children }) {
  const { user, loading, isTrialExpired } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg-primary"><LoadingSpinner size="lg" /></div>;
  if (!user) return <Navigate to="/" replace />;
  if (isTrialExpired) return <Navigate to="/trial-expired" replace />;
  return children;
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
        <Route path="/cookies" element={<LegalPage />} />

        {/* Auth (redirige si déjà connecté) */}
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

        {/* Liste d'attente — page publique */}
        <Route path="/waitlist" element={<WaitlistPage />} />

        {/* Portail franchisé — page publique sans authentification */}
        <Route path="/dip/partage/:token" element={<SharedDIPPage />} />
        <Route path="/contrat/partage/:token" element={<SharedContractPage />} />

        {/* Essai expiré — accessible aux utilisateurs connectés sans Layout */}
        <Route path="/trial-expired" element={<ProtectedRoute><TrialExpiredPage /></ProtectedRoute>} />

        {/* Pages protégées (bloquées si essai expiré) */}
        <Route path="/" element={<TrialGuard><Layout /></TrialGuard>}>
          <Route path="dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="dip" element={<ErrorBoundary><DIPPage /></ErrorBoundary>} />
          <Route path="dip/upload" element={<ErrorBoundary><UploadDIPPage /></ErrorBoundary>} />
          <Route path="dip/generate" element={<ErrorBoundary><GenerateDIPPage /></ErrorBoundary>} />
          <Route path="contrat" element={<ErrorBoundary><ContractPage /></ErrorBoundary>} />
          <Route path="contrat/upload" element={<ErrorBoundary><UploadContractPage /></ErrorBoundary>} />
          <Route path="contrat/generate" element={<ErrorBoundary><GenerateContractPage /></ErrorBoundary>} />
          <Route path="alerts" element={<ErrorBoundary><AlertsPage /></ErrorBoundary>} />
          <Route path="history" element={<ErrorBoundary><HistoryPage /></ErrorBoundary>} />
          <Route path="franchisees" element={<ErrorBoundary><FranchiseesPage /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
          <Route path="export" element={<ErrorBoundary><ExportPage /></ErrorBoundary>} />
          <Route path="admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
          <Route path="monitor" element={<ErrorBoundary><MonitorPage /></ErrorBoundary>} />
          <Route path="monitoring" element={<ErrorBoundary><DocMonitoringPage /></ErrorBoundary>} />
          <Route path="integrations" element={<ErrorBoundary><ApiConfigPage /></ErrorBoundary>} />
          <Route path="analytics/dip/:dipId" element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
