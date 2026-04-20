import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

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
