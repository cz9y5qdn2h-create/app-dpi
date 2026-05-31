import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import CommandPalette from './CommandPalette';
import api from '../lib/api';
import { Bell, Menu, Search } from 'lucide-react';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'pending'],
    queryFn: () => api.get('/alerts?status=pending').then(r => r.data),
    refetchInterval: 30000,
    retry: false
  });
  const pendingCount = alertsData?.alerts?.length || 0;

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-h-screen lg:ml-64">
        {/* Mobile header */}
        <header
          className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b"
          style={{ background: 'var(--header-bg)', backdropFilter: 'var(--sidebar-blur)', WebkitBackdropFilter: 'var(--sidebar-blur)', borderColor: 'var(--border-subtle)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-text-secondary hover:text-gold transition-colors p-1.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.04)' }}
          >
            <Menu className="w-4.5 h-4.5" />
          </button>

          <span className="font-cormorant text-xl text-gold">DIPpro</span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCmdOpen(true)}
              className="p-1.5 rounded-lg text-text-secondary hover:text-gold transition-colors"
              style={{ background: 'rgba(0,0,0,0.04)' }}
              aria-label="Recherche (⌘K)"
            >
              <Search className="w-4 h-4" />
            </button>
            <Link to="/alerts" className="relative p-1.5 text-text-secondary hover:text-gold transition-colors rounded-lg" style={{ background: 'rgba(0,0,0,0.04)' }}>
              <Bell className="w-4 h-4" />
              {pendingCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-danger text-white rounded-full flex items-center justify-center font-dm-mono leading-none" style={{ fontSize: 9 }}>
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Desktop search hint */}
        <div className="hidden lg:flex items-center justify-end px-8 pt-6 pb-0">
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'var(--glass-elevated)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-muted))' }}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="font-dm-sans text-xs">Recherche & navigation</span>
            <kbd className="font-dm-mono text-xs ml-1 px-1 rounded" style={{ background: 'var(--input-bg)', color: 'rgb(var(--text-secondary))' }}>⌘K</kbd>
          </button>
        </div>

        <div className="p-6 lg:p-8 pb-24 lg:pb-8 animate-fade-in">
          <Outlet />
        </div>
      </main>

      <BottomNav />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
