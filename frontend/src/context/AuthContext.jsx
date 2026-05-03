import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xlfycuhmbnzeofgnleof.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZnljdWhtYm56ZW9mZ25sZW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTY1MTAsImV4cCI6MjA5MTU3MjUxMH0.NcLXD5xzgokCnKcZv0laDMDP7ixrMqZvJNuCNQXLt3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit etre utilise dans AuthProvider');
  return ctx;
}

const withTimeout = (promise, ms, fallback = null) => Promise.race([
  promise,
  new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
]);

async function fetchProfile(userId) {
  try {
    const result = await withTimeout(
      supabase.from('users').select('*').eq('id', userId).single(),
      3000,
      { data: null }
    );
    return result?.data || null;
  } catch {
    return null;
  }
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const result = await withTimeout(
          supabase.auth.getSession(),
          5000,
          { data: { session: null } }
        );
        const session = result?.data?.session;

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          localStorage.setItem('access_token', session.access_token);
          const p = await fetchProfile(session.user.id);
          if (mounted) setProfile(p);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          localStorage.setItem('access_token', session.access_token);
          const p = await fetchProfile(session.user.id);
          if (mounted) setProfile(p);
        } else {
          setUser(null);
          setProfile(null);
          localStorage.removeItem('access_token');
        }
        if (event !== 'INITIAL_SESSION' && mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Identifiants invalides');
    localStorage.setItem('access_token', data.session.access_token);
    const p = await fetchProfile(data.user.id);
    setProfile(p);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, company_name) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, company_name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la creation du compte');
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('access_token');
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, supabase }}>
      {children}
    </AuthContext.Provider>
  );
}
