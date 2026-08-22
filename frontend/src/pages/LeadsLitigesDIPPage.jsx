import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Send, CheckCircle, ArrowLeft, BookOpen } from 'lucide-react';
import SEOHead from '../components/SEOHead';
import api from '../lib/api';

const GOLD = '#C8A96E';
const DARK = '#1A1826';
const GLASS = 'rgba(255,255,255,0.85)';
const BG = 'linear-gradient(145deg, #dde2f5 0%, #ebe7fa 40%, #dceaf8 70%, #e3e1f6 100%)';

const inputStyle = {
  background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(200,200,220,0.5)',
  color: DARK, width: '100%', padding: '13px 14px', borderRadius: 10,
  fontFamily: 'DM Sans, sans-serif', fontSize: 15, outline: 'none', boxSizing: 'border-box',
};

const labelStyle = { fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 5 };

export default function LeadsLitigesDIPPage() {
  const [form, setForm] = useState({ nom: '', email: '', telephone: '', structure: '' });
  const [consentement, setConsentement] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nom || !form.email || !form.telephone) {
      setError('Nom, email et téléphone sont requis');
      return;
    }
    if (!consentement) {
      setError('Le consentement est requis pour recevoir la ressource');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/leads/litiges-dip', { ...form, consentement });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Recevoir la base des litiges DIP — Ressource gratuite avocats"
        description="Recevez gratuitement la base des litiges DIP : sanctions, jurisprudence récente et fondements juridiques classés par manquement, pour avocats en droit de la franchise."
        canonical="/ressources/litiges-dip"
      />
      <div className="min-h-screen" style={{ background: BG }}>
        <header style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield style={{ width: 15, height: 15, color: GOLD }} />
            </div>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 19, color: DARK }}>DIPpro</span>
          </Link>
        </header>

        <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 60px' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <BookOpen style={{ width: 24, height: 24, color: GOLD }} />
            </div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400, fontSize: 30, color: DARK, lineHeight: 1.2, marginBottom: 10 }}>
              La base des litiges DIP
            </h1>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: '#64748B', lineHeight: 1.6 }}>
              Sanctions, jurisprudence récente et fondements juridiques classés par manquement à la Loi Doubin — envoyée gratuitement par email.
            </p>
          </div>

          <div style={{ borderRadius: 20, padding: '28px 24px', background: GLASS, backdropFilter: 'blur(24px)', border: '1px solid rgba(200,169,110,0.2)', boxShadow: '0 8px 40px rgba(80,90,140,0.12)' }}>
            {success ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                  <CheckCircle style={{ width: 26, height: 26, color: '#22C55E' }} />
                </div>
                <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: DARK, marginBottom: 8 }}>
                  Merci, {form.nom.split(' ')[0]}
                </h2>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 20 }}>
                  La ressource vient de vous être envoyée à {form.email}.
                </p>
                <Link to="/ressources/base-litiges-dip" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: GOLD, fontWeight: 600, textDecoration: 'underline' }}>
                  Consulter la ressource maintenant
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Nom et prénom <span style={{ color: '#EF4444' }}>*</span></label>
                  <input type="text" value={form.nom} onChange={e => set('nom', e.target.value)}
                    placeholder="Maître Jean Dupont" required autoComplete="name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email professionnel <span style={{ color: '#EF4444' }}>*</span></label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="vous@cabinet-avocat.fr" required autoComplete="email" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Téléphone <span style={{ color: '#EF4444' }}>*</span></label>
                  <input type="tel" value={form.telephone} onChange={e => set('telephone', e.target.value)}
                    placeholder="+33 6 12 34 56 78" required autoComplete="tel" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Cabinet / structure <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optionnel)</span></label>
                  <input type="text" value={form.structure} onChange={e => set('structure', e.target.value)}
                    placeholder="Nom du cabinet" autoComplete="organization" style={inputStyle} />
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={consentement} onChange={e => { setConsentement(e.target.checked); setError(''); }}
                    style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: GOLD, cursor: 'pointer' }} />
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: '#64748B', lineHeight: 1.55 }}>
                    J&apos;accepte que DIPpro (Iralink-Agency) utilise mes coordonnées pour m&apos;envoyer la ressource demandée et me recontacter au sujet de DIPpro. Voir notre{' '}
                    <Link to="/privacy" style={{ color: GOLD, textDecoration: 'underline' }}>politique de confidentialité</Link>.
                    Je peux me désinscrire à tout moment.
                  </span>
                </label>

                {error && (
                  <div style={{ borderRadius: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontFamily: 'DM Sans, sans-serif', fontSize: 12 }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '14px 24px', borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                    background: GOLD, color: DARK, fontFamily: 'DM Sans, sans-serif', fontSize: 15, fontWeight: 600,
                    boxShadow: '0 4px 16px rgba(200,169,110,0.35)', minHeight: 48,
                  }}>
                  {loading
                    ? <><span style={{ width: 16, height: 16, border: `2px solid ${DARK}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Envoi…</>
                    : <><Send style={{ width: 16, height: 16 }} /> Recevoir la ressource</>}
                </button>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </form>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: 20 }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: '#94A3B8', textDecoration: 'none' }}>
              <ArrowLeft style={{ width: 12, height: 12 }} /> Retour à l&apos;accueil
            </Link>
          </p>
        </main>
      </div>
    </>
  );
}
