import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEMES } from '../context/ThemeContext';
import api from '../lib/api';
import CalModal from './CalModal';
import {
  LayoutDashboard, FileText, Upload, Bell, History,
  Users, Settings, Download, LogOut, Shield, Phone, Zap, ShieldAlert, Sparkles
} from 'lucide-react';

export default function Sidebar({ open, onClose }) {
  const { profile, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [calOpen, setCalOpen] = useState(false);

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'pending'],
    queryFn: () => api.get('/alerts?status=pending').then(r => r.data),
    refetchInterval: 30000,
    retry: false
  });
  const pendingCount = alertsData?.alerts?.length || 0;
  const isAdmin = profile?.role === 'admin';

  const navItems = [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Tableau de bord' },
    { to: '/dip',          icon: FileText,        label: 'Mon DIP' },
    { to: '/dip/upload',   icon: Upload,          label: 'Nouvelle version' },
    { to: '/dip/generate', icon: Sparkles,        label: 'Générer un DIP' },
    { to: '/alerts',       icon: Bell,            label: 'Alertes', count: pendingCount },
    { to: '/history',      icon: History,         label: 'Historique' },
    { to: '/franchisees',  icon: Users,           label: 'Franchisés' },
    { to: '/export',       icon: Download,        label: 'Export' },
    { to: '/integrations', icon: Zap,             label: 'Intégrations' },
    { to: '/settings',     icon: Settings,        label: 'Paramètres' },
    ...(isAdmin ? [{ to: '/admin', icon: ShieldAlert, label: 'Admin', adminOnly: true }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <aside className={`
        sidebar-panel
        fixed top-0 left-0 h-full w-64 border-r border-border-subtle
        flex flex-col z-30 transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="px-6 py-8 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-gold" />
            </div>
            <div>
              <p className="font-cormorant text-xl text-text-primary leading-none">DIPpro</p>
              <p className="font-dm-mono text-xs text-text-secondary mt-0.5">by Iralink</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, count, adminOnly }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                adminOnly
                  ? (isActive ? 'nav-link-active' : 'nav-link text-gold/80 hover:text-gold')
                  : (isActive ? 'nav-link-active' : 'nav-link')
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
        </nav>

        {/* Bottom section */}
        <div className="px-3 py-4 border-t border-border-subtle space-y-3">

          {/* Contacter Iralink */}
          <button
            onClick={() => { setCalOpen(true); onClose?.(); }}
            className="btn-liquid-glass-prominent w-full text-sm py-2.5"
          >
            <Phone className="w-4 h-4" />
            Contacter Iralink
          </button>

          {/* Theme switcher */}
          <div className="px-1">
            <p className="font-dm-mono text-xs text-text-muted mb-2 uppercase tracking-widest">Thème</p>
            <div className="flex items-center gap-2">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  title={`${t.label} — ${t.desc}`}
                  className="w-[22px] h-[22px] rounded-full transition-all duration-200 hover:scale-125 flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)`,
                    outline: theme === t.id ? `2px solid ${t.accent}` : '2px solid transparent',
                    outlineOffset: '2px',
                    transform: theme === t.id ? 'scale(1.2)' : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          {/* User info */}
          <div className="px-3 py-2.5 rounded-lg bg-gold/5 border border-border-subtle">
            <p className="font-dm-sans text-sm text-text-primary truncate font-medium">
              {profile?.company_name || 'Franchiseur'}
            </p>
            <p className="font-dm-mono text-xs text-text-secondary truncate mt-0.5">
              {profile?.email || ''}
            </p>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="nav-link w-full text-left text-danger hover:text-danger hover:bg-danger/5"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <CalModal open={calOpen} onClose={() => setCalOpen(false)} />
    </>
  );
}
