import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, CheckCircle, Users, ArrowLeft, Send } from 'lucide-react';
import api from '../lib/api';

const BENEFITS = [
  'Accès prioritaire à DIPpro dès ouverture',
  'Onboarding personnalisé par l\'équipe Iralink',
  'Tarif préférentiel réservé aux premiers inscrits',
  'Analyse gratuite de votre DIP actuel',
];

export default function WaitlistPage() {
  const [form, setForm] = useState({ email: '', company_name: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.company_name) {
      setError('Email et nom de société sont requis');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/waitlist', { ...form, source: 'standalone' });
      if (res.data.already_exists) {
        setAlreadyExists(true);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid rgba(200,200,220,0.5)',
    color: '#1A1826',
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 14,
    outline: 'none',
    transition: 'border 0.2s'
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(145deg, #dde2f5 0%, #ebe7fa 40%, #dceaf8 70%, #e3e1f6 100%)'
    }}>
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{
              background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.3)'
            }}>
              <Shield className="w-7 h-7" style={{ color: '#C8A96E' }} />
            </div>
            <p className="font-cormorant text-2xl" style={{ color: '#1A1826' }}>DIPpro</p>
          </Link>
          <p className="font-dm-mono text-xs mt-1" style={{ color: '#94A3B8' }}>by Iralink</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{
          background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 32px rgba(80,90,140,0.1)'
        }}>

          {success ? (
            <div className="text-center space-y-5 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl mx-auto" style={{
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)'
              }}>
                <CheckCircle className="w-8 h-8" style={{ color: '#22C55E' }} />
              </div>
              <div>
                <h2 className="font-cormorant text-2xl mb-2" style={{ color: '#1A1826' }}>
                  Vous êtes sur la liste !
                </h2>
                <p className="font-dm-sans text-sm leading-relaxed" style={{ color: '#64748B' }}>
                  Inscription enregistrée pour <strong>{form.email}</strong>.
                  Notre équipe vous contactera en priorité dès que votre accès sera prêt.
                </p>
              </div>
              <div className="rounded-xl p-4" style={{
                background: 'rgba(200,169,110,0.08)', border: '1px solid rgba(200,169,110,0.2)'
              }}>
                <p className="font-dm-sans text-xs" style={{ color: '#64748B' }}>
                  Une question en attendant ?
                </p>
                <a href="mailto:theo@iralink-agency.com" className="font-dm-mono text-sm" style={{ color: '#C8A96E' }}>
                  theo@iralink-agency.com
                </a>
              </div>
              <Link to="/" className="inline-flex items-center gap-2 font-dm-sans text-sm" style={{ color: '#94A3B8' }}>
                <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
              </Link>
            </div>

          ) : alreadyExists ? (
            <div className="text-center space-y-5 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl mx-auto" style={{
                background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.2)'
              }}>
                <Users className="w-8 h-8" style={{ color: '#C8A96E' }} />
              </div>
              <div>
                <h2 className="font-cormorant text-2xl mb-2" style={{ color: '#1A1826' }}>
                  Déjà inscrit !
                </h2>
                <p className="font-dm-sans text-sm leading-relaxed" style={{ color: '#64748B' }}>
                  <strong>{form.email}</strong> est déjà sur notre liste d'attente.
                  Nous reviendrons vers vous très bientôt.
                </p>
              </div>
              <Link to="/" className="inline-flex items-center gap-2 font-dm-sans text-sm" style={{ color: '#94A3B8' }}>
                <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
              </Link>
            </div>

          ) : (
            <>
              <div className="mb-7">
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4" style={{
                  background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.2)'
                }}>
                  <Users className="w-3.5 h-3.5" style={{ color: '#C8A96E' }} />
                  <span className="font-dm-mono text-xs" style={{ color: '#C8A96E' }}>Accès anticipé</span>
                </div>
                <h1 className="font-cormorant text-3xl mb-2" style={{ color: '#1A1826' }}>
                  Rejoindre la liste d'attente
                </h1>
                <p className="font-dm-sans text-sm leading-relaxed" style={{ color: '#64748B' }}>
                  DIPpro ouvre progressivement. Inscrivez-vous pour être contacté en priorité par l'équipe Iralink.
                </p>
              </div>

              {/* Avantages */}
              <div className="space-y-2 mb-6 p-4 rounded-xl" style={{
                background: 'rgba(200,169,110,0.05)', border: '1px solid rgba(200,169,110,0.12)'
              }}>
                {BENEFITS.map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22C55E' }} />
                    <span className="font-dm-sans text-xs" style={{ color: '#64748B' }}>{b}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div className="rounded-xl px-4 py-3 mb-4 font-dm-sans text-sm" style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444'
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="font-dm-sans text-xs font-medium block mb-1.5" style={{ color: '#475569' }}>
                    Nom de la société / Enseigne <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={e => set('company_name', e.target.value)}
                    placeholder="Ma Franchise SAS"
                    required
                    style={inputStyle}
                    onFocus={e => e.target.style.border = '1px solid rgba(200,169,110,0.6)'}
                    onBlur={e => e.target.style.border = '1px solid rgba(200,200,220,0.5)'}
                  />
                </div>

                <div>
                  <label className="font-dm-sans text-xs font-medium block mb-1.5" style={{ color: '#475569' }}>
                    Adresse email <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="vous@entreprise.fr"
                    required
                    autoComplete="email"
                    style={inputStyle}
                    onFocus={e => e.target.style.border = '1px solid rgba(200,169,110,0.6)'}
                    onBlur={e => e.target.style.border = '1px solid rgba(200,200,220,0.5)'}
                  />
                </div>

                <div>
                  <label className="font-dm-sans text-xs font-medium block mb-1.5" style={{ color: '#475569' }}>
                    Téléphone <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optionnel)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                    autoComplete="tel"
                    style={inputStyle}
                    onFocus={e => e.target.style.border = '1px solid rgba(200,169,110,0.6)'}
                    onBlur={e => e.target.style.border = '1px solid rgba(200,200,220,0.5)'}
                  />
                </div>

                <div>
                  <label className="font-dm-sans text-xs font-medium block mb-1.5" style={{ color: '#475569' }}>
                    Message <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optionnel)</span>
                  </label>
                  <textarea
                    value={form.message}
                    onChange={e => set('message', e.target.value)}
                    placeholder="Dites-nous en plus sur votre réseau, vos besoins..."
                    rows={3}
                    style={{ ...inputStyle, resize: 'none' }}
                    onFocus={e => e.target.style.border = '1px solid rgba(200,169,110,0.6)'}
                    onBlur={e => e.target.style.border = '1px solid rgba(200,200,220,0.5)'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !form.email || !form.company_name}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-dm-sans text-sm font-medium transition-all"
                  style={{
                    background: form.email && form.company_name ? '#C8A96E' : 'rgba(200,169,110,0.4)',
                    color: '#1A1826',
                    cursor: form.email && form.company_name ? 'pointer' : 'not-allowed',
                    boxShadow: form.email && form.company_name ? '0 4px 16px rgba(200,169,110,0.3)' : 'none',
                  }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Inscription…
                    </span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      M'inscrire sur la liste d'attente
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between mt-6 pt-5 border-t" style={{ borderColor: 'rgba(200,169,110,0.15)' }}>
                <Link to="/" className="inline-flex items-center gap-2 font-dm-sans text-xs" style={{ color: '#94A3B8' }}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Retour
                </Link>
                <Link to="/login" className="font-dm-sans text-xs" style={{ color: '#C8A96E' }}>
                  Déjà un compte ? Se connecter
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="font-dm-sans text-xs text-center mt-6" style={{ color: '#94A3B8' }}>
          Vos données sont confidentielles et ne sont jamais partagées.
        </p>
      </div>
    </div>
  );
}
