import { Outlet, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Sidebar from './Sidebar';
import api from '../lib/api';
import { Bell, Menu } from 'lucide-react';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'pending'],
    queryFn: () => api.get('/alerts?status=pending').then(r => r.data),
    refetchInterval: 30000,
    retry: false
  });
  const pendingCount = alertsData?.alerts?.length || 0;

  return (
    <div className="flex min-h-screen bg-bg-primary">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 min-h-screen lg:ml-64">
        <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-4 border-b border-border-subtle bg-bg-card/90 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-text-secondary hover:text-gold transition-colors p-1"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-cormorant text-xl text-gold">DIPpro</span>
          <Link to="/alerts" className="relative p-1 text-text-secondary hover:text-gold transition-colors">
            <Bell className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger text-white text-xs rounded-full flex items-center justify-center font-dm-mono leading-none">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </Link>
        </header>
        <div className="p-6 lg:p-8 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
