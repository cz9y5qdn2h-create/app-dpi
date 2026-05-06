import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

export default function LoginPage() {
  const { login, loginWithGoogle, loginWithApple } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setError('');
    setOauthLoading('google');
    try { await loginWithGoogle(); }
    catch (err) { setError(err.message); setOauthLoading(''); }
  };

  const handleApple = async () => {
    setError('');
    setOauthLoading('apple');
    try { await loginWithApple(); }
    catch (err) { setError(err.message); setOauthLoading(''); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('fetch') || msg.includes('Invalid value') || msg.includes('Failed to')) {
        setError('Configuration incomplète : variables Supabase manquantes côté Vercel. Contactez l\'administrateur.');
      } else if (msg.includes('Invalid login') || msg.includes('Identifiants')) {
        setError('Email ou mot de passe incorrect.');
      } else {
        setError(msg || 'Erreur de connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      {/* Fond décoratif */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold/3 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gold/2 rounded-full blur-2xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* En-tête */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gold/10 border border-gold/30 mb-6">
            <Shield className="w-7 h-7 text-gold" />
          </div>
          <h1 className="font-cormorant text-4xl text-text-primary font-light">DIPpro</h1>
          <p className="font-dm-sans text-sm text-text-secondary mt-2">
            Gestion légale du DIP · by Iralink
          </p>
        </div>

        {/* Formulaire */}
        <div className="card border-border-default">
          <h2 className="font-cormorant text-2xl text-text-primary mb-6">Connexion</h2>

          {error && (
            <div className="flex items-center gap-3 bg-danger/10 border border-danger/20 text-danger rounded p-3 mb-5 text-sm font-dm-sans">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Adresse email</label>
              <input
                type="email"
                className="input-field"
                placeholder="vous@entreprise.fr"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-12"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
            >
              {loading ? <LoadingSpinner size="sm" /> : null}
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-bg-card font-dm-sans text-xs text-text-muted">ou continuer avec</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={!!oauthLoading}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border-default bg-bg-elevated hover:bg-bg-card font-dm-sans text-sm text-text-primary transition-all disabled:opacity-50"
            >
              {oauthLoading === 'google' ? <LoadingSpinner size="sm" /> : <GoogleIcon />}
              Google
            </button>
            <button
              type="button"
              onClick={handleApple}
              disabled={!!oauthLoading}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border-default bg-bg-elevated hover:bg-bg-card font-dm-sans text-sm text-text-primary transition-all disabled:opacity-50"
            >
              {oauthLoading === 'apple' ? <LoadingSpinner size="sm" /> : <AppleIcon />}
              Apple
            </button>
          </div>

          <div className="divider" />

          <p className="text-center font-dm-sans text-sm text-text-secondary">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-gold hover:text-gold-light transition-colors">
              Créer un compte
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center font-dm-mono text-xs text-text-muted mt-8">
          Loi Doubin — Article L.330-3 du Code de commerce
        </p>
      </div>
    </div>
  );
}
