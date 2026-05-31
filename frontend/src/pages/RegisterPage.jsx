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
  const [consents, setConsents] = useState({
    terms: false,
    aiDisclaimer: false,
    marketing: false,
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
  const strengthColors = ['#EF4444', '#EF4444', '#FBBF24', '#C8A96E', '#34D399'];
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
    if (!consents.terms) return setError('Vous devez accepter les CGU et la politique de confidentialité pour continuer');
    if (!consents.aiDisclaimer) return setError('Vous devez confirmer avoir compris que les analyses IA ne constituent pas un conseil juridique');
    setLoading(true);
    try {
      await register(form.email, form.password, form.company_name, form.phone_number, {
        marketing_consent: consents.marketing,
        ai_disclaimer_accepted: consents.aiDisclaimer,
      });
      toast.success('Compte créé ! Votre essai gratuit de 5 jours commence maintenant.');
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{
      background: `
        radial-gradient(ellipse 55% 50% at 15% 70%, rgba(200,169,110,0.20) 0%, transparent 60%),
        radial-gradient(ellipse 40% 60% at 80% 20%, rgba(180,140,70,0.14) 0%, transparent 55%),
        radial-gradient(ellipse 60% 40% at 60% 85%, rgba(140,100,40,0.10) 0%, transparent 60%),
        linear-gradient(160deg, #0a0805 0%, #0f0d08 25%, #080808 55%, #060606 100%)
      `
    }}>

      {/* Panneau gauche */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12" style={{
        background: 'rgba(8,8,8,0.60)',
        backdropFilter: 'blur(40px)',
        borderRight: '0.5px solid rgba(200,169,110,0.10)'
      }}>
        <div className="flex items-center gap-3">
          <div className="lg-avatar">
            <Shield className="w-4 h-4" style={{ color: '#C8A96E' }} />
          </div>
          <div>
            <p className="font-cormorant text-xl" style={{ color: '#F4F2EE' }}>DIPpro</p>
            <p className="font-dm-mono text-xs" style={{ color: 'rgba(244,242,238,0.35)' }}>by Iralink</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="font-dm-mono text-xs mb-3" style={{ color: '#C8A96E', textTransform: 'uppercase', letterSpacing: '0.10em' }}>Essai gratuit 5 jours</p>
            <p className="font-cormorant text-4xl leading-snug mb-4" style={{ color: '#F4F2EE', fontWeight: 300 }}>
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
              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#34D399' }} />
              <span className="font-dm-sans text-sm" style={{ color: 'rgba(244,242,238,0.60)' }}>{item}</span>
            </div>
          ))}
        </div>

        <p className="font-dm-mono text-xs" style={{ color: 'rgba(244,242,238,0.22)' }}>
          Art. L.330-3 Code de commerce
        </p>
      </div>

      {/* Panneau droit */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="lg-avatar">
              <Shield className="w-4 h-4" style={{ color: '#C8A96E' }} />
            </div>
            <p className="font-cormorant text-xl" style={{ color: '#F4F2EE' }}>DIPpro</p>
          </div>

          <div className="mb-7">
            <h1 className="font-cormorant text-3xl mb-1" style={{ color: '#F4F2EE', fontWeight: 300 }}>Créer un compte</h1>
            <p className="font-dm-sans text-sm" style={{ color: 'rgba(244,242,238,0.44)' }}>
              Déjà un compte ?{' '}
              <Link to="/login" className="font-medium" style={{ color: '#C8A96E' }}>Se connecter</Link>
            </p>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2 mb-7">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center transition-all" style={{
                    background: i < step ? 'rgba(52,211,153,0.20)' : i === step ? 'rgba(200,169,110,0.20)' : 'rgba(244,242,238,0.06)',
                    border: i < step ? '0.5px solid rgba(52,211,153,0.40)' : i === step ? '0.5px solid rgba(200,169,110,0.40)' : '0.5px solid rgba(244,242,238,0.12)',
                    color: i < step ? '#34D399' : i === step ? '#C8A96E' : 'rgba(244,242,238,0.30)',
                    fontSize: 11,
                    fontFamily: 'DM Mono, monospace'
                  }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="font-dm-sans text-xs hidden sm:block" style={{
                    color: i === step ? '#F4F2EE' : 'rgba(244,242,238,0.35)'
                  }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px" style={{
                    background: i < step ? 'rgba(52,211,153,0.30)' : 'rgba(244,242,238,0.08)'
                  }} />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-4 font-dm-sans text-sm" style={{
              background: 'rgba(248,113,113,0.08)',
              border: '0.5px solid rgba(248,113,113,0.25)',
              color: '#F87171'
            }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={step < 2 ? (e) => { e.preventDefault(); nextStep(); } : handleSubmit} className="space-y-4">

            {/* Étape 0 — Société */}
            {step === 0 && (
              <div>
                <label className="lg-label">Nom de la société / Enseigne</label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={e => set('company_name', e.target.value)}
                  placeholder="Ma Franchise SAS"
                  required
                  autoFocus
                  className="lg-input"
                />
                <p className="font-dm-sans text-xs mt-1.5" style={{ color: 'rgba(244,242,238,0.30)' }}>
                  Nom qui apparaîtra sur vos DIPs
                </p>
              </div>
            )}

            {/* Étape 1 — Contact */}
            {step === 1 && (
              <>
                <div>
                  <label className="lg-label">Adresse email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="vous@entreprise.fr"
                    required
                    autoFocus
                    autoComplete="email"
                    className="lg-input"
                  />
                </div>
                <div>
                  <label className="lg-label">
                    Téléphone <span style={{ color: 'rgba(244,242,238,0.28)', textTransform: 'none', fontSize: 10 }}>(optionnel)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone_number}
                    onChange={e => set('phone_number', e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                    autoComplete="tel"
                    className="lg-input"
                  />
                </div>
              </>
            )}

            {/* Étape 2 — Sécurité */}
            {step === 2 && (
              <>
                <div>
                  <label className="lg-label">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                      autoComplete="new-password"
                      className="lg-input"
                      style={{ paddingRight: '44px' }}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(244,242,238,0.35)' }}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="h-0.5 flex-1 rounded-full transition-all" style={{
                            background: i <= strength ? strengthColors[strength] : 'rgba(244,242,238,0.08)'
                          }} />
                        ))}
                      </div>
                      <p className="font-dm-mono text-xs" style={{ color: strengthColors[strength], fontSize: 10 }}>
                        {strengthLabels[strength]}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="lg-label">Confirmer le mot de passe</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={e => set('confirmPassword', e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className="lg-input"
                      style={{
                        paddingRight: '44px',
                        borderColor: form.confirmPassword
                          ? form.password === form.confirmPassword
                            ? 'rgba(52,211,153,0.45)'
                            : 'rgba(248,113,113,0.45)'
                          : undefined
                      }}
                    />
                    {form.confirmPassword && form.password === form.confirmPassword && (
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#34D399' }} />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Consentements — étape 2 */}
            {step === 2 && (
              <div className="space-y-3 pt-1">
                <ConsentCheckbox
                  id="consent-terms"
                  checked={consents.terms}
                  onChange={v => setConsents(c => ({ ...c, terms: v }))}
                  label={
                    <>
                      J'ai lu et j'accepte les{' '}
                      <a href="/cgu" target="_blank" rel="noopener noreferrer" style={{ color: '#C8A96E', textDecoration: 'underline' }}>CGU</a>
                      {' '}et la{' '}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#C8A96E', textDecoration: 'underline' }}>politique de confidentialité</a>
                      {' '}de DIPpro *
                    </>
                  }
                />
                <ConsentCheckbox
                  id="consent-ai"
                  checked={consents.aiDisclaimer}
                  onChange={v => setConsents(c => ({ ...c, aiDisclaimer: v }))}
                  label="Je comprends que les analyses de DIPpro sont des outils d'aide à la décision et ne constituent pas un conseil juridique. Tout DIP doit être validé par un avocat. *"
                />
                <ConsentCheckbox
                  id="consent-marketing"
                  checked={consents.marketing}
                  onChange={v => setConsents(c => ({ ...c, marketing: v }))}
                  label="J'accepte de recevoir des informations sur DIPpro par email (facultatif)"
                />
                <p className="font-dm-mono" style={{ fontSize: 10, color: 'rgba(244,242,238,0.28)' }}>* Champs obligatoires</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (step === 2 && (!consents.terms || !consents.aiDisclaimer))}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-dm-sans text-sm transition-all"
              style={{
                background: loading || (step === 2 && (!consents.terms || !consents.aiDisclaimer))
                  ? 'rgba(200,169,110,0.20)'
                  : 'rgba(200,169,110,0.16)',
                border: `0.5px solid ${loading || (step === 2 && (!consents.terms || !consents.aiDisclaimer)) ? 'rgba(200,169,110,0.18)' : 'rgba(200,169,110,0.42)'}`,
                color: loading || (step === 2 && (!consents.terms || !consents.aiDisclaimer)) ? 'rgba(200,169,110,0.45)' : '#C8A96E',
                cursor: loading || (step === 2 && (!consents.terms || !consents.aiDisclaimer)) ? 'not-allowed' : 'pointer',
                fontWeight: 500
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
                style={{ color: 'rgba(244,242,238,0.35)', background: 'transparent', border: 'none' }}
              >
                ← Retour
              </button>
            )}
          </form>

          <p className="font-dm-sans text-xs text-center mt-6" style={{ color: 'rgba(244,242,238,0.30)' }}>
            Pas encore prêt ?{' '}
            <Link to="/waitlist" style={{ color: '#C8A96E' }}>Rejoindre la liste d'attente</Link>
          </p>

          <p className="font-dm-sans text-xs text-center mt-3" style={{ color: 'rgba(244,242,238,0.22)' }}>
            <Link to="/mentions-legales" style={{ color: 'rgba(244,242,238,0.22)' }}>Mentions légales</Link>
            {' · '}
            <Link to="/cookies" style={{ color: 'rgba(244,242,238,0.22)' }}>Cookies</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function ConsentCheckbox({ id, checked, onChange, label }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
      <div className="flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className="w-4 h-4 rounded flex items-center justify-center transition-all"
          style={{
            background: checked ? 'rgba(200,169,110,0.20)' : 'rgba(244,242,238,0.04)',
            border: checked ? '0.5px solid rgba(200,169,110,0.50)' : '0.5px solid rgba(244,242,238,0.14)',
          }}
        >
          {checked && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="#C8A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
      <span className="font-dm-sans text-xs leading-relaxed" style={{ color: 'rgba(244,242,238,0.50)' }}>
        {label}
      </span>
    </label>
  );
}
