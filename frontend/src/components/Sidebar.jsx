import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import CalModal from './CalModal';
import LiquidGlassBtn from './ui/LiquidGlassBtn';
import {
  LayoutDashboard, FileText, Upload, Bell, History,
  Users, Settings, Download, LogOut, Phone, Zap, ShieldAlert, Sparkles,
  Sun, Moon, FolderSync
} from 'lucide-react';

export default function Sidebar({ open, onClose }) {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [calOpen, setCalOpen] = useState(false);

  const toggleLang = () => {
    const next = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(next);
    localStorage.setItem('dippro-lang', next);
  };

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'pending'],
    queryFn: () => api.get('/alerts?status=pending').then(r => r.data),
    refetchInterval: 30000,
    retry: false
  });
  const pendingCount = alertsData?.alerts?.length || 0;
  const isAdmin = profile?.role === 'admin';

  const navItems = [
    { to: '/dashboard',    icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/dip',          icon: FileText,        label: t('nav.myDip') },
    { to: '/dip/upload',   icon: Upload,          label: t('nav.newVersion') },
    { to: '/dip/generate', icon: Sparkles,        label: t('nav.generateDip') },
    { to: '/alerts',       icon: Bell,            label: t('nav.alerts'), count: pendingCount },
    { to: '/history',      icon: History,         label: t('nav.history') },
    { to: '/franchisees',  icon: Users,           label: t('nav.franchisees') },
    { to: '/export',       icon: Download,        label: t('nav.export') },
    { to: '/monitor',      icon: FolderSync,      label: t('nav.docMonitoring') },
    { to: '/integrations', icon: Zap,             label: t('nav.integrations') },
    { to: '/settings',     icon: Settings,        label: t('nav.settings') },
    ...(isAdmin ? [{ to: '/admin', icon: ShieldAlert, label: t('nav.admin'), adminOnly: true }] : []),
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
        <div className="px-4 py-5" style={{ borderBottom: '0.5px solid rgba(200,169,110,0.12)', marginBottom: 8 }}>
          <div className="lg-logo-brand-pill">
            <div className="lg-logo-brand-icon">D</div>
            <span className="lg-logo-brand-text">DIPpro</span>
          </div>
          <p className="lg-logo-brand-sub">by Iralink</p>
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
              {t('nav.contact')}
            </span>
          </LiquidGlassBtn>

          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="nav-link w-full text-left"
          >
            <span className="font-dm-mono text-xs font-medium" style={{ letterSpacing: '0.05em' }}>
              <span style={{ color: i18n.language === 'fr' ? 'rgb(var(--gold))' : undefined }}>FR</span>
              {' / '}
              <span style={{ color: i18n.language === 'en' ? 'rgb(var(--gold))' : undefined }}>EN</span>
            </span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="nav-link w-full text-left"
          >
            {theme === 'clair' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>{theme === 'clair' ? t('nav.darkMode') : t('nav.lightMode')}</span>
          </button>

          {/* User info */}
          <div className="lg-user-chip">
            <p className="font-dm-sans text-sm text-text-primary truncate" style={{ fontWeight: 500 }}>
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
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      <CalModal open={calOpen} onClose={() => setCalOpen(false)} />
    </>
  );
}
