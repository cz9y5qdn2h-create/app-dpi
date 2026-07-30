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
const AvocatJoinPage     = lazy(() => import('./pages/AvocatJoinPage'));
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

function FranchisorOnlyRoute({ children }) {
  const { profile } = useAuth();
  if (profile?.role === 'avocat') return <Navigate to="/dashboard" replace />;
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
        <Route path="/avocat/rejoindre/:token" element={<S><AvocatJoinPage /></S>} />

        <Route path="/trial-expired" element={<ProtectedRoute><S><TrialExpiredPage /></S></ProtectedRoute>} />

        <Route path="/" element={<TrialGuard><Layout /></TrialGuard>}>
          <Route path="dashboard"   element={<ErrorBoundary><S><DashboardPage /></S></ErrorBoundary>} />
          <Route path="dip"         element={<FranchisorOnlyRoute><ErrorBoundary><S><DIPPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="dip/upload"  element={<FranchisorOnlyRoute><ErrorBoundary><S><UploadDIPPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="dip/generate" element={<FranchisorOnlyRoute><ErrorBoundary><S><GenerateDIPPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="contrat"             element={<FranchisorOnlyRoute><ErrorBoundary><S><ContractPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="contrat/upload"      element={<FranchisorOnlyRoute><ErrorBoundary><S><UploadContractPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="contrat/generate"    element={<FranchisorOnlyRoute><ErrorBoundary><S><GenerateContractPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="alerts"      element={<FranchisorOnlyRoute><ErrorBoundary><S><AlertsPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="history"     element={<FranchisorOnlyRoute><ErrorBoundary><S><HistoryPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="franchisees" element={<FranchisorOnlyRoute><ErrorBoundary><S><FranchiseesPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="settings"    element={<ErrorBoundary><S><SettingsPage /></S></ErrorBoundary>} />
          <Route path="export"      element={<FranchisorOnlyRoute><ErrorBoundary><S><ExportPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="certifications" element={<FranchisorOnlyRoute><ErrorBoundary><S><CertificatesPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="documents"      element={<FranchisorOnlyRoute><ErrorBoundary><S><DocumentsPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="admin"       element={<ErrorBoundary><S><AdminPage /></S></ErrorBoundary>} />
          <Route path="monitor"     element={FEATURES.monitor ? <FranchisorOnlyRoute><ErrorBoundary><S><MonitorPage /></S></ErrorBoundary></FranchisorOnlyRoute> : <Navigate to="/dashboard" replace />} />
          <Route path="monitoring"  element={<FranchisorOnlyRoute><ErrorBoundary><S><DocMonitoringPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="integrations" element={<FranchisorOnlyRoute><ErrorBoundary><S><ApiConfigPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="analytics/dip/:dipId"          element={<FranchisorOnlyRoute><ErrorBoundary><S><AnalyticsPage /></S></ErrorBoundary></FranchisorOnlyRoute>} />
          <Route path="dip/avocat/:franchiseurId"      element={<ErrorBoundary><S><DIPAvocatPage /></S></ErrorBoundary>} />
          <Route path="design-preview" element={FEATURES.design_preview ? <ErrorBoundary><S><DesignPreviewPage /></S></ErrorBoundary> : <Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
