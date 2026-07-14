import { createContext, useContext, useEffect, useRef, useState } from 'react';
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

const PROFILE_CACHE_KEY = 'dippro-profile-v1';

function getCachedProfile(userId) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const { id, data } = JSON.parse(raw);
    return id === userId ? data : null;
  } catch {
    return null;
  }
}

function setCachedProfile(userId, data) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ id: userId, data }));
  } catch {}
}

function clearCachedProfile() {
  localStorage.removeItem(PROFILE_CACHE_KEY);
}

async function fetchProfile(userId) {
  try {
    const result = await withTimeout(
      supabase.from('users').select('*').eq('id', userId).single(),
      4000,
      { data: null }
    );
    const profile = result?.data || null;
    if (profile) setCachedProfile(userId, profile);
    return profile;
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
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);
  const mfaPendingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const result = await withTimeout(
          supabase.auth.getSession(),
          3000,
          { data: { session: null } }
        );
        const session = result?.data?.session;

        if (!mounted) return;

        if (session?.user) {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
            if (mounted) setLoading(false);
            return;
          }

          setUser(session.user);
          localStorage.setItem('access_token', session.access_token);

          // Afficher le profil caché immédiatement — l'UI s'affiche sans attendre Supabase
          const cached = getCachedProfile(session.user.id);
          if (cached && mounted) {
            setProfile(cached);
            setLoading(false);
          }

          // Fetch en background et mettre à jour si différent
          const fresh = await fetchProfile(session.user.id);
          if (mounted && fresh) setProfile(fresh);
          if (!cached && mounted) setLoading(false);
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

        if (event === 'PASSWORD_RECOVERY') {
          if (mounted) { setNeedsPasswordReset(true); setLoading(false); }
          return;
        }

        if (event === 'SIGNED_IN' && !mfaPendingRef.current) {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
            if (mounted) setLoading(false);
            return;
          }
        }

        if (mfaPendingRef.current && event === 'SIGNED_IN') {
          if (mounted) setLoading(false);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          localStorage.setItem('access_token', session.access_token);
          const p = await fetchProfile(session.user.id);
          if (mounted) setProfile(p);
        } else {
          setUser(null);
          setProfile(null);
          clearCachedProfile();
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
    mfaPendingRef.current = true;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      mfaPendingRef.current = false;
      throw new Error('Identifiants invalides');
    }

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.find(f => f.status === 'verified');
      if (totpFactor) {
        return { mfaRequired: true, factorId: totpFactor.id };
      }
    }

    mfaPendingRef.current = false;
    localStorage.setItem('access_token', data.session.access_token);

    // Affiche le profil caché immédiatement — la redirection ne doit pas
    // attendre l'aller-retour réseau vers Supabase (jusqu'à 4s de timeout)
    const cached = getCachedProfile(data.user.id);
    if (cached) setProfile(cached);
    setUser(data.user);

    // Rafraîchit en arrière-plan, sans bloquer le retour de login()
    fetchProfile(data.user.id).then(p => { if (p) setProfile(p); });

    return data.user;
  };

  const verifyMFA = async (factorId, code) => {
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw new Error('Code incorrect');
    mfaPendingRef.current = false;
    localStorage.setItem('access_token', data.session.access_token);

    const cached = getCachedProfile(data.user.id);
    if (cached) setProfile(cached);
    setUser(data.user);

    fetchProfile(data.user.id).then(p => { if (p) setProfile(p); });

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
        role: consentData.role || 'franchiseur',
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la création du compte');
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    clearCachedProfile();
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
      login, register, logout, refreshProfile, verifyMFA,
      supabase,
      isTrialExpired,
      trialDaysLeft,
      needsPasswordReset,
      clearPasswordReset: () => setNeedsPasswordReset(false)
    }}>
      {children}
    </AuthContext.Provider>
  );
}
