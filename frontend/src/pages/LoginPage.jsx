import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

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
      const msg = err?.message || '';
      if (msg.includes('fetch') || msg.includes('Invalid value') || msg.includes('Failed to')) {
        setError('Erreur de configuration. Contactez l\'administrateur.');
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
    <div className="min-h-screen flex" style={{
      background: 'linear-gradient(145deg, #dde2f5 0%, #ebe7fa 40%, #dceaf8 70%, #e3e1f6 100%)'
    }}>
      {/* Panneau gauche — branding */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12" style={{
        background: 'rgba(26,24,38,0.92)', backdropFilter: 'blur(24px)'
      }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
            background: 'rgba(200,169,110,0.15)', border: '1px solid rgba(200,169,110,0.3)'
          }}>
            <Shield className="w-5 h-5" style={{ color: '#C8A96E' }} />
          </div>
          <div>
            <p className="font-cormorant text-xl" style={{ color: '#F8F6F0' }}>DIPpro</p>
            <p className="font-dm-mono text-xs" style={{ color: '#64748B' }}>by Iralink</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <p className="font-cormorant text-4xl leading-snug mb-4" style={{ color: '#F8F6F0' }}>
              Conformité DIP<br />sans effort.
            </p>
            <p className="font-dm-sans text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
              Analysez, corrigez et partagez vos Documents d'Information Précontractuelle en toute conformité avec la Loi Doubin.
            </p>
          </div>

          {[
            'Analyse IA des 10 sections réglementaires',
            'Alertes de conformité en temps réel',
            'Notifications automatiques aux franchisés',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#C8A96E' }} />
              <span className="font-dm-sans text-sm" style={{ color: '#CBD5E1' }}>{item}</span>
            </div>
          ))}
        </div>

        <p className="font-dm-mono text-xs" style={{ color: '#475569' }}>
          Art. L.330-3 Code de commerce
        </p>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{
              background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.3)'
            }}>
              <Shield className="w-4.5 h-4.5" style={{ color: '#C8A96E' }} />
            </div>
            <p className="font-cormorant text-xl" style={{ color: '#1A1826' }}>DIPpro</p>
          </div>

          <div className="mb-8">
            <h1 className="font-cormorant text-3xl mb-1" style={{ color: '#1A1826' }}>Connexion</h1>
            <p className="font-dm-sans text-sm" style={{ color: '#64748B' }}>
              Pas encore de compte ?{' '}
              <Link to="/register" className="font-medium" style={{ color: '#C8A96E' }}>
                Commencer l'essai gratuit
              </Link>
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-5 font-dm-sans text-sm" style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444'
            }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="font-dm-sans text-xs font-medium" style={{ color: '#475569' }}>
                Adresse email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="vous@entreprise.fr"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl font-dm-sans text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.75)',
                  border: '1px solid rgba(200,200,220,0.5)',
                  color: '#1A1826',
                  backdropFilter: 'blur(8px)'
                }}
                onFocus={e => e.target.style.border = '1px solid rgba(200,169,110,0.6)'}
                onBlur={e => e.target.style.border = '1px solid rgba(200,200,220,0.5)'}
              />
            </div>

            <div className="space-y-1">
              <label className="font-dm-sans text-xs font-medium" style={{ color: '#475569' }}>
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 rounded-xl font-dm-sans text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.75)',
                    border: '1px solid rgba(200,200,220,0.5)',
                    color: '#1A1826',
                    backdropFilter: 'blur(8px)'
                  }}
                  onFocus={e => e.target.style.border = '1px solid rgba(200,169,110,0.6)'}
                  onBlur={e => e.target.style.border = '1px solid rgba(200,200,220,0.5)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#94A3B8' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !form.email || !form.password}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-dm-sans text-sm font-medium transition-all mt-2"
              style={{
                background: loading || !form.email || !form.password
                  ? 'rgba(200,169,110,0.4)'
                  : '#C8A96E',
                color: '#1A1826',
                boxShadow: loading || !form.email || !form.password
                  ? 'none'
                  : '0 4px 16px rgba(200,169,110,0.35)',
                cursor: loading || !form.email || !form.password ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Connexion…
                </span>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="font-dm-mono text-xs text-center mt-8" style={{ color: '#94A3B8' }}>
            Données sécurisées · Conforme RGPD
          </p>
        </div>
      </div>
    </div>
  );
}
