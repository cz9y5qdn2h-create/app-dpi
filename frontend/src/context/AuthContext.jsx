import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit etre utilise dans AuthProvider');
  return ctx;
}

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Session initiale
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        localStorage.setItem('access_token', session.access_token);
        const p = await fetchProfile(session.user.id);
        setProfile(p);
      }
      setLoading(false);
    });

    // Ecouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          localStorage.setItem('access_token', session.access_token);
          const p = await fetchProfile(session.user.id);
          setProfile(p);
        } else {
          setUser(null);
          setProfile(null);
          localStorage.removeItem('access_token');
        }
        if (event !== 'INITIAL_SESSION') setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Login DIRECT via Supabase (ne passe pas par le backend)
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Identifiants invalides');
    localStorage.setItem('access_token', data.session.access_token);
    const p = await fetchProfile(data.user.id);
    setProfile(p);
    setUser(data.user);
    return data.user;
  };

  // Register via backend (cree le compte Supabase + profil users)
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
