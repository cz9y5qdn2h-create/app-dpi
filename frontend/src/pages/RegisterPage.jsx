import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', company_name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = passwordStrength(form.password);
  const strengthColors = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-gold', 'bg-success'];
  const strengthLabels = ['', 'Faible', 'Moyen', 'Bon', 'Excellent'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      return setError('Les mots de passe ne correspondent pas');
    }
    if (strength < 2) {
      return setError('Mot de passe trop faible');
    }
    setLoading(true);
    try {
      await register(form.email, form.password, form.company_name);
      toast.success('Compte créé avec succès !');
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold/3 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gold/10 border border-gold/30 mb-6">
            <Shield className="w-7 h-7 text-gold" />
          </div>
          <h1 className="font-cormorant text-4xl text-text-primary font-light">DIPpro</h1>
          <p className="font-dm-sans text-sm text-text-secondary mt-2">Créez votre compte franchiseur · by Iralink</p>
        </div>

        <div className="card border-border-default">
          <h2 className="font-cormorant text-2xl text-text-primary mb-6">Inscription</h2>

          {error && (
            <div className="flex items-center gap-3 bg-danger/10 border border-danger/20 text-danger rounded p-3 mb-5 text-sm font-dm-sans">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nom de la société / Enseigne</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ma Franchise SAS"
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="label">Adresse email</label>
              <input
                type="email"
                className="input-field"
                placeholder="vous@entreprise.fr"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i <= strength ? strengthColors[strength] : 'bg-bg-elevated'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-dm-mono text-text-secondary mt-1">
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="label">Confirmer le mot de passe</label>
              <div className="relative">
                <input
                  type="password"
                  className={`input-field pr-10 ${
                    form.confirmPassword && form.password !== form.confirmPassword
                      ? 'border-danger focus:border-danger'
                      : form.confirmPassword && form.password === form.confirmPassword
                      ? 'border-success'
                      : ''
                  }`}
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  required
                />
                {form.confirmPassword && form.password === form.confirmPassword && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-success" />
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
            >
              {loading ? <LoadingSpinner size="sm" /> : null}
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <div className="divider" />
          <p className="text-center font-dm-sans text-sm text-text-secondary">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-gold hover:text-gold-light transition-colors">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
