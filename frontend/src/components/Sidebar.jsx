import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, FileText, Upload, Bell, History,
  Users, Settings, Download, LogOut, Shield
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/dip', icon: FileText, label: 'Mon DIP' },
  { to: '/dip/upload', icon: Upload, label: 'Upload DIP' },
  { to: '/alerts', icon: Bell, label: 'Alertes', badge: true },
  { to: '/history', icon: History, label: 'Historique' },
  { to: '/franchisees', icon: Users, label: 'Franchisés' },
  { to: '/export', icon: Download, label: 'Export' },
  { to: '/settings', icon: Settings, label: 'Paramètres' },
];

export default function Sidebar({ open, onClose }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

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
      {/* Logo */}
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              isActive ? 'nav-link-active' : 'nav-link'
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Profil & logout */}
      <div className="px-3 py-4 border-t border-border-subtle">
        <div className="px-4 py-3 mb-2">
          <p className="font-dm-sans text-sm text-text-primary truncate">
            {profile?.company_name || 'Franchiseur'}
          </p>
          <p className="font-dm-mono text-xs text-text-secondary truncate">
            {profile?.email || ''}
          </p>
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
