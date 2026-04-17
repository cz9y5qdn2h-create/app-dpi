import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle, Lock } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Identifiants invalides');
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
          <h1 className="font-cormorant text-4xl text-text-primary font-light">DIP Pilot</h1>
          <p className="font-dm-sans text-sm text-text-secondary mt-2">
            Conformité franchise automatisée — Loi Doubin
          </p>
        </div>

        {/* Formulaire */}
        <div className="card border-border-default">
          <h2 className="font-cormorant text-2xl text-text-primary mb-2">Connexion</h2>
          <p className="font-dm-sans text-xs text-text-secondary mb-6 flex items-center gap-1.5">
            <Lock className="w-3 h-3 flex-shrink-0" />
            Accès réservé aux clients autorisés
          </p>

          {error && (
            <div className="flex items-start gap-3 bg-danger/10 border border-danger/20 text-danger rounded p-3 mb-5 text-sm font-dm-sans">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
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

          <div className="divider" />

          {/* Accès sur invitation */}
          <div className="text-center">
            <p className="font-dm-sans text-sm text-text-secondary">
              Pas encore de compte ?
            </p>
            <p className="font-dm-sans text-xs text-text-muted mt-1">
              L&apos;accès à DIP Pilot est sur invitation uniquement.{' '}
              <a
                href="mailto:theo@iralink-agency.com"
                className="text-gold hover:text-gold-light transition-colors"
              >
                Contactez-nous
              </a>
            </p>
          </div>
        </div>

        {/* Notice RGPD & légale */}
        <div className="mt-6 space-y-2 text-center">
          <p className="font-dm-mono text-xs text-text-muted">
            Loi Doubin — Art. L.330-3 du Code de commerce
          </p>
          <p className="font-dm-sans text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
            En vous connectant, vous acceptez que vos données soient traitées conformément au{' '}
            <span className="text-text-secondary">Règlement (UE) 2016/679 (RGPD)</span>.
            Données hébergées en Union Européenne. Responsable de traitement&nbsp;: Iralink Agency.
          </p>
        </div>
      </div>
    </div>
  );
}
