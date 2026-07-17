import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthProvider from './context/AuthContext';
import { FEATURES } from './lib/features';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Chargement immédiat — requis pour le shell applicatif
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy loading — chaque page n'est téléchargée que si elle est visitée
const LoginPage          = lazy(() => import('./pages/LoginPage'));
const RegisterPage       = lazy(() => import('./pages/RegisterPage'));
const LandingPage        = lazy(() => import('./pages/LandingPage'));
const LegalPage          = lazy(() => import('./pages/LegalPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'));
const WaitlistPage       = lazy(() => import('./pages/WaitlistPage'));
const SharedDIPPage      = lazy(() => import('./pages/SharedDIPPage'));
const SharedContractPage = lazy(() => import('./pages/SharedContractPage'));
const TrialExpiredPage   = lazy(() => import('./pages/TrialExpiredPage'));
const DashboardPage      = lazy(() => import('./pages/DashboardPage'));
const DIPPage            = lazy(() => import('./pages/DIPPage'));
const UploadDIPPage      = lazy(() => import('./pages/UploadDIPPage'));
const GenerateDIPPage    = lazy(() => import('./pages/GenerateDIPPage'));
const ContractPage       = lazy(() => import('./pages/ContractPage'));
const UploadContractPage = lazy(() => import('./pages/UploadContractPage'));
const GenerateContractPage = lazy(() => import('./pages/GenerateContractPage'));
const AlertsPage         = lazy(() => import('./pages/AlertsPage'));
const HistoryPage        = lazy(() => import('./pages/HistoryPage'));
const FranchiseesPage    = lazy(() => import('./pages/FranchiseesPage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const ExportPage         = lazy(() => import('./pages/ExportPage'));
const CertificatesPage   = lazy(() => import('./pages/CertificatesPage'));
const DocumentsPage      = lazy(() => import('./pages/DocumentsPage'));
const AdminPage          = lazy(() => import('./pages/AdminPage'));
const ApiConfigPage      = lazy(() => import('./pages/ApiConfigPage'));
const MonitorPage        = lazy(() => import('./pages/MonitorPage'));
const DocMonitoringPage  = lazy(() => import('./pages/DocMonitoringPage'));
const AnalyticsPage      = lazy(() => import('./pages/AnalyticsPage'));
const DIPAvocatPage      = lazy(() => import('./pages/DIPAvocatPage'));
const DesignPreviewPage  = lazy(() => import('./pages/DesignPreviewPage'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-bg-primary">
    <LoadingSpinner size="lg" />
  </div>
);

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <Suspense fallback={<PageLoader />}>
      <LandingPage />
    </Suspense>
  );
}

function TrialGuard({ children }) {
  const { user, loading, isTrialExpired } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/" replace />;
  if (isTrialExpired) return <Navigate to="/trial-expired" replace />;
  return children;
}

const S = ({ children }) => <Suspense fallback={<PageLoader />}>{children}</Suspense>;

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route path="/cgu"             element={<S><LegalPage /></S>} />
        <Route path="/privacy"         element={<S><LegalPage /></S>} />
        <Route path="/mentions-legales" element={<S><LegalPage /></S>} />
        <Route path="/cookies"         element={<S><LegalPage /></S>} />

        <Route path="/login"            element={<PublicOnlyRoute><S><LoginPage /></S></PublicOnlyRoute>} />
        <Route path="/register"         element={<PublicOnlyRoute><S><RegisterPage /></S></PublicOnlyRoute>} />
        <Route path="/forgot-password"  element={<PublicOnlyRoute><S><ForgotPasswordPage /></S></PublicOnlyRoute>} />
        <Route path="/reset-password"   element={<S><ResetPasswordPage /></S>} />

        <Route path="/waitlist"               element={<S><WaitlistPage /></S>} />
        <Route path="/dip/partage/:token"     element={<S><SharedDIPPage /></S>} />
        <Route path="/contrat/partage/:token" element={<S><SharedContractPage /></S>} />

        <Route path="/trial-expired" element={<ProtectedRoute><S><TrialExpiredPage /></S></ProtectedRoute>} />

        <Route path="/" element={<TrialGuard><Layout /></TrialGuard>}>
          <Route path="dashboard"   element={<ErrorBoundary><S><DashboardPage /></S></ErrorBoundary>} />
          <Route path="dip"         element={<ErrorBoundary><S><DIPPage /></S></ErrorBoundary>} />
          <Route path="dip/upload"  element={<ErrorBoundary><S><UploadDIPPage /></S></ErrorBoundary>} />
          <Route path="dip/generate" element={<ErrorBoundary><S><GenerateDIPPage /></S></ErrorBoundary>} />
          <Route path="contrat"             element={<ErrorBoundary><S><ContractPage /></S></ErrorBoundary>} />
          <Route path="contrat/upload"      element={<ErrorBoundary><S><UploadContractPage /></S></ErrorBoundary>} />
          <Route path="contrat/generate"    element={<ErrorBoundary><S><GenerateContractPage /></S></ErrorBoundary>} />
          <Route path="alerts"      element={<ErrorBoundary><S><AlertsPage /></S></ErrorBoundary>} />
          <Route path="history"     element={<ErrorBoundary><S><HistoryPage /></S></ErrorBoundary>} />
          <Route path="franchisees" element={<ErrorBoundary><S><FranchiseesPage /></S></ErrorBoundary>} />
          <Route path="settings"    element={<ErrorBoundary><S><SettingsPage /></S></ErrorBoundary>} />
          <Route path="export"      element={<ErrorBoundary><S><ExportPage /></S></ErrorBoundary>} />
          <Route path="certifications" element={<ErrorBoundary><S><CertificatesPage /></S></ErrorBoundary>} />
          <Route path="documents"      element={<ErrorBoundary><S><DocumentsPage /></S></ErrorBoundary>} />
          <Route path="admin"       element={<ErrorBoundary><S><AdminPage /></S></ErrorBoundary>} />
          <Route path="monitor"     element={FEATURES.monitor ? <ErrorBoundary><S><MonitorPage /></S></ErrorBoundary> : <Navigate to="/dashboard" replace />} />
          <Route path="monitoring"  element={<ErrorBoundary><S><DocMonitoringPage /></S></ErrorBoundary>} />
          <Route path="integrations" element={<ErrorBoundary><S><ApiConfigPage /></S></ErrorBoundary>} />
          <Route path="analytics/dip/:dipId"          element={<ErrorBoundary><S><AnalyticsPage /></S></ErrorBoundary>} />
          <Route path="dip/avocat/:franchiseurId"      element={<ErrorBoundary><S><DIPAvocatPage /></S></ErrorBoundary>} />
          <Route path="design-preview" element={FEATURES.design_preview ? <ErrorBoundary><S><DesignPreviewPage /></S></ErrorBoundary> : <Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
