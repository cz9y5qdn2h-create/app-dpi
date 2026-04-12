import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthProvider from './context/AuthContext';
import Layout from './components/Layout';
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
      <Routes>
        {/* Pages publiques */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Pages protégées */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="dip" element={<DIPPage />} />
          <Route path="dip/upload" element={<UploadDIPPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="franchisees" element={<FranchiseesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
