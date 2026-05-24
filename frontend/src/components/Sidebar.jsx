import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import CalModal from './CalModal';
import LiquidGlassBtn from './ui/LiquidGlassBtn';
import {
  LayoutDashboard, FileText, Upload, Bell, History,
  Users, Settings, Download, LogOut, Shield, Phone, Zap, ShieldAlert, Sparkles,
  Sun, Moon, FolderSync
} from 'lucide-react';

export default function Sidebar({ open, onClose }) {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
    { to: '/monitor',      icon: FolderSync,      label: 'Surveillance docs' },
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
          <LiquidGlassBtn
            onClick={() => { setCalOpen(true); onClose?.(); }}
            padding="10px 20px"
            cornerRadius={10}
            displacementScale={60}
            blurAmount={0.08}
            saturation={140}
            aberrationIntensity={1.5}
            elasticity={0.2}
            mode="prominent"
            className="w-full"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'white' }}>
              <Phone style={{ width: 14, height: 14 }} />
              Contacter Iralink
            </span>
          </LiquidGlassBtn>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="nav-link w-full text-left"
          >
            {theme === 'clair' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>{theme === 'clair' ? 'Mode sombre' : 'Mode clair'}</span>
          </button>

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
