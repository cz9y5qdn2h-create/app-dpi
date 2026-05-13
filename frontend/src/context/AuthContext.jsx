import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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

function isTrialExpiredFn(profile) {
  if (!profile) return false;
  if (profile.role === 'admin') return false;
  if (profile.appointment_booked === true) return false;
  if (!profile.trial_expires_at) return false;
  return new Date() > new Date(profile.trial_expires_at);
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

  const register = async (email, password, company_name, phone_number, consentData = {}) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, password, company_name, phone_number,
        marketing_consent: consentData.marketing_consent ?? false,
        ai_disclaimer_accepted: consentData.ai_disclaimer_accepted ?? false,
        terms_accepted_at: new Date().toISOString(),
        terms_version: '2026-05-13',
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la création du compte');
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('access_token');
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    }
  };

  const isTrialExpired = isTrialExpiredFn(profile);

  const trialDaysLeft = (() => {
    if (!profile?.trial_expires_at || profile.role === 'admin' || profile.appointment_booked) return null;
    const diff = new Date(profile.trial_expires_at) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  })();

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      login, register, logout, refreshProfile,
      supabase,
      isTrialExpired,
      trialDaysLeft
    }}>
      {children}
    </AuthContext.Provider>
  );
}
