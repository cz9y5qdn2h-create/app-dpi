import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = 'theo@iralink-agency.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
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

  const isAdmin = profile?.role === 'admin' || profile?.email === ADMIN_EMAIL;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        localStorage.setItem('access_token', session.access_token);
        const p = await fetchProfile(session.user.id);
        // Déconnecter si compte inactif
        if (p && p.is_active === false) {
          await supabase.auth.signOut();
          localStorage.removeItem('access_token');
          setUser(null);
          setProfile(null);
        } else {
          setProfile(p);
        }
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          localStorage.setItem('access_token', session.access_token);
          const p = await fetchProfile(session.user.id);
          if (p && p.is_active === false) {
            await supabase.auth.signOut();
            localStorage.removeItem('access_token');
            setUser(null);
            setProfile(null);
          } else {
            setProfile(p);
          }
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

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Identifiants invalides');

    const p = await fetchProfile(data.user.id);

    // Vérifier que le compte est actif
    if (p && p.is_active === false) {
      await supabase.auth.signOut();
      throw new Error('Votre compte a été désactivé. Contactez l\'administrateur à theo@iralink-agency.com');
    }

    localStorage.setItem('access_token', data.session.access_token);
    setProfile(p);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('access_token');
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, isAdmin, supabase }}>
      {children}
    </AuthContext.Provider>
  );
}
