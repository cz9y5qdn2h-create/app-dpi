import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import {
  LayoutDashboard, FileText, Upload, Bell, History,
  Users, Settings, Download, LogOut, Shield, ShieldAlert
} from 'lucide-react';

export default function Sidebar({ open, onClose }) {
  const { profile, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'pending'],
    queryFn: () => api.get('/alerts?status=pending').then(r => r.data),
    refetchInterval: 30000,
    retry: false
  });
  const pendingCount = alertsData?.alerts?.length || 0;

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { to: '/dip', icon: FileText, label: 'Mon DIP' },
    { to: '/dip/upload', icon: Upload, label: 'Importer DIP' },
    { to: '/alerts', icon: Bell, label: 'Alertes', count: pendingCount },
    { to: '/history', icon: History, label: 'Historique' },
    { to: '/franchisees', icon: Users, label: 'Franchisés' },
    { to: '/export', icon: Download, label: 'Export' },
    { to: '/settings', icon: Settings, label: 'Paramètres' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full w-64 bg-bg-card border-r border-border-subtle
        flex flex-col z-30 transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}
    >
      <div className="px-6 py-8 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gold/10 border border-gold/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="font-cormorant text-xl text-text-primary leading-none">DIP Pilot</p>
            <p className="font-dm-mono text-xs text-text-secondary mt-0.5">v1.0 beta</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, count }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              isActive ? 'nav-link-active' : 'nav-link'
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {count > 0 && (
              <span className="font-dm-mono text-xs bg-danger text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </NavLink>
        ))}

        {/* Section admin — visible uniquement pour l'administrateur */}
        {isAdmin && (
          <div className="pt-3 mt-3 border-t border-border-subtle">
            <p className="font-dm-mono text-xs text-text-muted px-4 pb-2 uppercase tracking-wider">Administration</p>
            <NavLink
              to="/admin"
              onClick={onClose}
              className={({ isActive }) =>
                isActive ? 'nav-link-active' : 'nav-link'
              }
            >
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-gold" />
              <span className="flex-1">Gestion clients</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-border-subtle">
        <div className="px-4 py-3 mb-1 rounded bg-bg-elevated">
          <p className="font-dm-sans text-sm text-text-primary truncate font-medium">
            {profile?.company_name || 'Utilisateur'}
          </p>
          <p className="font-dm-mono text-xs text-text-secondary truncate mt-0.5">
            {profile?.email || ''}
          </p>
          {isAdmin && (
            <p className="font-dm-mono text-xs text-gold mt-0.5">Administrateur</p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="nav-link w-full text-left text-danger hover:text-danger hover:bg-danger/5"
        >
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
