import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthProvider from './context/AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ui/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import DIPPage from './pages/DIPPage';
import UploadDIPPage from './pages/UploadDIPPage';
import AlertsPage from './pages/AlertsPage';
import HistoryPage from './pages/HistoryPage';
import FranchiseesPage from './pages/FranchiseesPage';
import SettingsPage from './pages/SettingsPage';
import ExportPage from './pages/ExportPage';
import LoadingSpinner from './components/ui/LoadingSpinner';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg-primary"><LoadingSpinner size="lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg-primary"><LoadingSpinner size="lg" /></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
            <Route path="dip" element={<ErrorBoundary><DIPPage /></ErrorBoundary>} />
            <Route path="dip/upload" element={<ErrorBoundary><UploadDIPPage /></ErrorBoundary>} />
            <Route path="alerts" element={<ErrorBoundary><AlertsPage /></ErrorBoundary>} />
            <Route path="history" element={<ErrorBoundary><HistoryPage /></ErrorBoundary>} />
            <Route path="franchisees" element={<ErrorBoundary><FranchiseesPage /></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
            <Route path="export" element={<ErrorBoundary><ExportPage /></ErrorBoundary>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ErrorBoundary>
    </AuthProvider>
  );
}
