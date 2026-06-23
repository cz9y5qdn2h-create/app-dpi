import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import {
  LayoutDashboard, FileText, Bell, Users, MoreHorizontal,
  Upload, Sparkles, Download, History, Settings, LogOut, X
} from 'lucide-react';
import { useState } from 'react';

const PRIMARY_TABS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Accueil' },
  { to: '/dip',         icon: FileText,         label: 'Mon DIP' },
  { to: '/alerts',      icon: Bell,             label: 'Alertes',    badge: true },
  { to: '/franchisees', icon: Users,            label: 'Franchisés' },
];

const MORE_ITEMS = [
  { to: '/dip/upload',   icon: Upload,    label: 'Nouvelle version' },
  { to: '/dip/generate', icon: Sparkles,  label: 'Générer un DIP' },
  { to: '/history',      icon: History,   label: 'Historique' },
  { to: '/export',       icon: Download,  label: 'Export' },
  { to: '/settings',     icon: Settings,  label: 'Paramètres' },
];

export default function BottomNav({ onClose }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const navBg        = 'var(--header-bg)';
  const sheetBg       = 'var(--glass-bg)';
  const sheetBorder    = 'var(--glass-border)';
  const dividerColor   = 'var(--border-subtle)';
  const iconBgDefault  = 'var(--row-bg)';
  const labelColor     = 'rgb(var(--text-secondary))';
  const titleColor     = 'rgb(var(--text-primary))';

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'pending'],
    queryFn: () => api.get('/alerts?status=pending').then(r => r.data),
    refetchInterval: 30000,
    retry: false,
    staleTime: 10000,
  });
  const pendingCount = alertsData?.alerts?.length || 0;

  const handleLogout = async () => {
    setMoreOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* More sheet overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/35" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />

          <div
            className="absolute bottom-20 left-3 right-3 rounded-2xl overflow-hidden animate-slide-up"
            style={{ background: sheetBg, backdropFilter: 'blur(32px) saturate(200%)', WebkitBackdropFilter: 'blur(32px) saturate(200%)', border: `1px solid ${sheetBorder}`, boxShadow: '0 16px 48px rgba(0,0,0,0.14)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: dividerColor }}>
              <span className="font-cormorant text-lg" style={{ color: titleColor }}>Plus</span>
              <button onClick={() => setMoreOpen(false)} className="p-1 rounded-lg" style={{ background: iconBgDefault }}>
                <X className="w-4 h-4" style={{ color: labelColor }} />
              </button>
            </div>

            <div className="p-3 grid grid-cols-3 gap-2">
              {MORE_ITEMS.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${isActive ? 'bg-gold/12' : 'hover:bg-black/4'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isActive ? 'rgb(var(--gold) / 0.18)' : iconBgDefault, border: isActive ? '1px solid rgb(var(--gold) / 0.35)' : '1px solid transparent' }}>
                        <Icon className="w-5 h-5" style={{ color: isActive ? 'rgb(var(--gold))' : labelColor }} />
                      </div>
                      <span className="font-dm-sans text-xs text-center" style={{ color: isActive ? 'rgb(var(--gold))' : labelColor }}>
                        {label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            <div className="px-3 pb-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                style={{ background: 'rgb(var(--danger) / 0.06)', border: '1px solid rgb(var(--danger) / 0.12)' }}
              >
                <LogOut className="w-4 h-4 text-danger" />
                <span className="font-dm-sans text-sm text-danger">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 lg:hidden pb-safe"
        style={{ background: navBg, backdropFilter: 'blur(40px) saturate(220%)', WebkitBackdropFilter: 'blur(40px) saturate(220%)', borderTop: `1px solid ${sheetBorder}`, boxShadow: '0 -4px 24px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-stretch h-16 px-2">
          {PRIMARY_TABS.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl mx-0.5 transition-all ${isActive ? 'text-gold' : 'text-text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {badge && pendingCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-danger text-white text-xs rounded-full flex items-center justify-center font-dm-mono leading-none" style={{ fontSize: 9 }}>
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    )}
                  </div>
                  <span className="font-dm-sans" style={{ fontSize: 10, fontWeight: isActive ? 500 : 400 }}>{label}</span>
                  {isActive && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl mx-0.5 transition-all ${moreOpen ? 'text-gold' : 'text-text-muted'}`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="font-dm-sans" style={{ fontSize: 10 }}>Plus</span>
          </button>
        </div>
      </nav>
    </>
  );
}
