import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = ['Société', 'Contact', 'Sécurité'];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    company_name: '',
    email: '',
    phone_number: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const passwordStrength = (pwd) => {
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
  };
  const strength = passwordStrength(form.password);
  const strengthColors = ['#EF4444', '#EF4444', '#F59E0B', '#C8A96E', '#22C55E'];
  const strengthLabels = ['', 'Faible', 'Moyen', 'Bon', 'Excellent'];

  const nextStep = () => {
    if (step === 0 && !form.company_name.trim()) return setError('Nom de société requis');
    if (step === 1 && !form.email.trim()) return setError('Email requis');
    setError('');
    setStep(s => s + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return setError('Les mots de passe ne correspondent pas');
    if (strength < 2) return setError('Mot de passe trop faible (min. 8 caractères, 1 majuscule, 1 chiffre)');
    setLoading(true);
    try {
      await register(form.email, form.password, form.company_name, form.phone_number);
      toast.success('Compte créé ! Votre essai gratuit de 5 jours commence maintenant.');
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.75)',
    border: '1px solid rgba(200,200,220,0.5)',
    color: '#1A1826',
    backdropFilter: 'blur(8px)'
  };

  return (
    <div className="min-h-screen flex" style={{
      background: 'linear-gradient(145deg, #dde2f5 0%, #ebe7fa 40%, #dceaf8 70%, #e3e1f6 100%)'
    }}>
      {/* Panneau gauche */}
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

        <div className="space-y-6">
          <div>
            <p className="font-dm-mono text-xs mb-3" style={{ color: '#C8A96E' }}>Essai gratuit 5 jours</p>
            <p className="font-cormorant text-4xl leading-snug mb-4" style={{ color: '#F8F6F0' }}>
              Votre DIP conforme<br />en quelques minutes.
            </p>
          </div>
          {[
            'Analyse IA immédiate de votre document',
            'Corrections section par section',
            'Aucune carte bancaire requise',
            'Accès complet pendant 5 jours',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#22C55E' }} />
              <span className="font-dm-sans text-sm" style={{ color: '#CBD5E1' }}>{item}</span>
            </div>
          ))}
        </div>

        <p className="font-dm-mono text-xs" style={{ color: '#475569' }}>
          Art. L.330-3 Code de commerce
        </p>
      </div>

      {/* Panneau droit */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{
              background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.3)'
            }}>
              <Shield className="w-4 h-4" style={{ color: '#C8A96E' }} />
            </div>
            <p className="font-cormorant text-xl" style={{ color: '#1A1826' }}>DIPpro</p>
          </div>

          <div className="mb-7">
            <h1 className="font-cormorant text-3xl mb-1" style={{ color: '#1A1826' }}>Créer un compte</h1>
            <p className="font-dm-sans text-sm" style={{ color: '#64748B' }}>
              Déjà un compte ?{' '}
              <Link to="/login" className="font-medium" style={{ color: '#C8A96E' }}>Se connecter</Link>
            </p>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2 mb-7">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-dm-mono transition-all" style={{
                    background: i < step ? '#22C55E' : i === step ? '#C8A96E' : 'rgba(200,200,220,0.3)',
                    color: i <= step ? '#fff' : '#94A3B8',
                    fontSize: 11
                  }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="font-dm-sans text-xs hidden sm:block" style={{
                    color: i === step ? '#1A1826' : '#94A3B8'
                  }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px" style={{
                    background: i < step ? '#22C55E' : 'rgba(200,200,220,0.4)'
                  }} />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-4 font-dm-sans text-sm" style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444'
            }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={step < 2 ? (e) => { e.preventDefault(); nextStep(); } : handleSubmit} className="space-y-4">
            {/* Étape 0 — Société */}
            {step === 0 && (
              <div className="space-y-1">
                <label className="font-dm-sans text-xs font-medium" style={{ color: '#475569' }}>
                  Nom de la société / Enseigne
                </label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={e => set('company_name', e.target.value)}
                  placeholder="Ma Franchise SAS"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl font-dm-sans text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => e.target.style.border = '1px solid rgba(200,169,110,0.6)'}
                  onBlur={e => e.target.style.border = '1px solid rgba(200,200,220,0.5)'}
                />
                <p className="font-dm-sans text-xs pt-1" style={{ color: '#94A3B8' }}>
                  Nom qui apparaîtra sur vos DIPs
                </p>
              </div>
            )}

            {/* Étape 1 — Contact */}
            {step === 1 && (
              <>
                <div className="space-y-1">
                  <label className="font-dm-sans text-xs font-medium" style={{ color: '#475569' }}>Adresse email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="vous@entreprise.fr"
                    required
                    autoFocus
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl font-dm-sans text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => e.target.style.border = '1px solid rgba(200,169,110,0.6)'}
                    onBlur={e => e.target.style.border = '1px solid rgba(200,200,220,0.5)'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-dm-sans text-xs font-medium" style={{ color: '#475569' }}>
                    Téléphone <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optionnel)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone_number}
                    onChange={e => set('phone_number', e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                    autoComplete="tel"
                    className="w-full px-4 py-3 rounded-xl font-dm-sans text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => e.target.style.border = '1px solid rgba(200,169,110,0.6)'}
                    onBlur={e => e.target.style.border = '1px solid rgba(200,200,220,0.5)'}
                  />
                </div>
              </>
            )}

            {/* Étape 2 — Sécurité */}
            {step === 2 && (
              <>
                <div className="space-y-1">
                  <label className="font-dm-sans text-xs font-medium" style={{ color: '#475569' }}>Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                      autoComplete="new-password"
                      className="w-full px-4 py-3 pr-11 rounded-xl font-dm-sans text-sm outline-none transition-all"
                      style={inputStyle}
                      onFocus={e => e.target.style.border = '1px solid rgba(200,169,110,0.6)'}
                      onBlur={e => e.target.style.border = '1px solid rgba(200,200,220,0.5)'}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="h-1 flex-1 rounded-full transition-all" style={{
                            background: i <= strength ? strengthColors[strength] : 'rgba(200,200,220,0.3)'
                          }} />
                        ))}
                      </div>
                      <p className="font-dm-mono text-xs" style={{ color: strengthColors[strength] }}>
                        {strengthLabels[strength]}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="font-dm-sans text-xs font-medium" style={{ color: '#475569' }}>Confirmer le mot de passe</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={e => set('confirmPassword', e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className="w-full px-4 py-3 pr-11 rounded-xl font-dm-sans text-sm outline-none transition-all"
                      style={{
                        ...inputStyle,
                        border: form.confirmPassword
                          ? form.password === form.confirmPassword
                            ? '1px solid rgba(34,197,94,0.5)'
                            : '1px solid rgba(239,68,68,0.5)'
                          : inputStyle.border
                      }}
                    />
                    {form.confirmPassword && form.password === form.confirmPassword && (
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#22C55E' }} />
                    )}
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-dm-sans text-sm font-medium transition-all"
              style={{
                background: '#C8A96E',
                color: '#1A1826',
                boxShadow: '0 4px 16px rgba(200,169,110,0.35)',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Création…
                </span>
              ) : step < 2 ? (
                <>Continuer <ArrowRight className="w-4 h-4" /></>
              ) : (
                <>Créer mon compte <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

            {step > 0 && (
              <button
                type="button"
                onClick={() => { setStep(s => s - 1); setError(''); }}
                className="w-full py-2 font-dm-sans text-sm transition-colors"
                style={{ color: '#94A3B8' }}
              >
                ← Retour
              </button>
            )}
          </form>

          <p className="font-dm-sans text-xs text-center mt-6" style={{ color: '#94A3B8' }}>
            Pas encore prêt à vous lancer ?{' '}
            <Link to="/waitlist" style={{ color: '#C8A96E' }}>Rejoindre la liste d'attente</Link>
          </p>

          <p className="font-dm-sans text-xs text-center mt-3 leading-relaxed" style={{ color: '#94A3B8' }}>
            En créant un compte, vous acceptez nos{' '}
            <Link to="/cgu" className="underline" style={{ color: '#C8A96E' }}>CGU</Link>
            {' '}et notre{' '}
            <Link to="/privacy" className="underline" style={{ color: '#C8A96E' }}>politique de confidentialité</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
