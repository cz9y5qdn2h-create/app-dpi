import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, CheckCircle, Bell, Users, Download, Zap, ArrowRight,
  ChevronDown, Sparkles, AlertTriangle, FileText, Send, Lock,
  FileCheck, Clock, TrendingUp, Star, GitBranch
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import api from '../lib/api';

const GOLD = '#C8A96E';

const DARK_BG = {
  background: `
    radial-gradient(ellipse 55% 50% at 15% 70%, rgba(200,169,110,0.18) 0%, transparent 60%),
    radial-gradient(ellipse 40% 60% at 80% 20%, rgba(180,140,70,0.12) 0%, transparent 55%),
    radial-gradient(ellipse 60% 40% at 60% 85%, rgba(140,100,40,0.08) 0%, transparent 60%),
    linear-gradient(160deg, #0a0805 0%, #0f0d08 25%, #080808 55%, #060606 100%)`
};

const FEATURES = [
  { icon: Sparkles,   title: 'Analyse IA en 30 s',         desc: 'Score de conformité Loi Doubin instantané. Les 10 sections réglementaires évaluées par Claude Opus.' },
  { icon: Shield,     title: 'Génération guidée',           desc: 'Formulaire en 8 étapes + assistant IA qui rédige les sections complexes conformément au Décret 91-337.' },
  { icon: Zap,        title: 'Détection des changements',   desc: 'Chaque modification légale à notifier sous 20 jours est identifiée, qualifiée et tracée automatiquement.' },
  { icon: FileCheck,  title: 'Attestation certifiée',       desc: 'PDF horodaté, empreinte SHA-256, lien public vérifiable — preuve de remise incontestable en cas de litige.' },
  { icon: Bell,       title: 'Alertes renouvellement',      desc: 'Rappels automatiques 90, 30 et 7 jours avant l\'expiration annuelle obligatoire.' },
  { icon: Users,      title: 'Portail franchisé',           desc: 'Notification email + WhatsApp automatique à tous vos franchisés dès approbation d\'une modification.' },
];

const HOW_STEPS = [
  {
    num: '01',
    icon: FileText,
    title: 'Importez votre DIP',
    desc: 'Glissez votre PDF ou DOCX. L\'IA extrait les 10 sections réglementaires Loi Doubin en moins de 30 secondes.',
  },
  {
    num: '02',
    icon: Sparkles,
    title: 'Analysez & corrigez',
    desc: 'Score par section, recommandations ciblées, corrections proposées par l\'IA. Vous validez en un clic.',
  },
  {
    num: '03',
    icon: FileCheck,
    title: 'Certifiez & notifiez',
    desc: 'Attestation PDF horodatée générée automatiquement + notification email à tous vos franchisés actifs.',
  },
];

const FAQS = [
  {
    q: "Qu'est-ce que le DIP ?",
    a: "Le Document d'Information Précontractuelle est obligatoire pour tout franchiseur (Art. L.330-3 Code de commerce). Il doit être remis au candidat franchisé 20 jours avant la signature. Son absence ou son inexactitude suffit à entraîner la nullité du contrat — confirmé par la Cour de cassation, 26 juin 2024.",
  },
  {
    q: "DIPpro remplace-t-il un avocat ?",
    a: "Non — DIPpro prépare et structure le travail. Votre avocat valide. Notre rapport de conformité divise généralement par 3 le temps de révision juridique et évite les oublis de sections critiques.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Hébergement exclusif en Europe (Supabase / AWS eu-west). JWT + Row Level Security Postgres, chiffrement TLS, audit log immuable. Plein RGPD — aucune donnée partagée avec des tiers.",
  },
  {
    q: "Qu'est-ce que l'accès anticipé ?",
    a: "Le MVP est fonctionnel et déployé. Les premiers franchiseurs accèdent à toutes les fonctionnalités dès aujourd'hui. En échange de votre retour structuré, vous bénéficiez du tarif Early Adopter garanti à vie.",
  },
  {
    q: "Combien coûte DIPpro ?",
    a: "Les inscrits sur la liste d'attente bénéficient d'un tarif Early Adopter exclusif, inférieur de 40 % au tarif public à l'ouverture. Le tarif exact vous est communiqué par email à l'activation. Aucune carte bancaire requise pour s'inscrire.",
  },
];

// ─── Utils ────────────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className = '', style = {} }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.08 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.70s ease ${delay}ms, transform 0.70s ease ${delay}ms`,
      ...style,
    }}>{children}</div>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '0.5px solid rgba(200,169,110,0.14)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0', cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left', gap: 16 }}
      >
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 500, color: '#F4F2EE' }}>{q}</span>
        <ChevronDown style={{ width: 16, height: 16, color: GOLD, flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(244,242,238,0.52)', lineHeight: 1.75, paddingBottom: 20, margin: 0 }}>{a}</p>
      )}
    </div>
  );
}

// ─── Dashboard mockup ─────────────────────────────────────────────────────────

function DashboardMockup() {
  return (
    <div style={{
      background: 'rgba(8,8,8,0.97)',
      borderRadius: 20,
      border: '0.5px solid rgba(200,169,110,0.22)',
      padding: 20,
      boxShadow: '0 40px 100px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(200,169,110,0.08)',
      width: '100%',
    }}>
      {/* Traffic lights */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        {['#EF4444', '#FBBF24', '#22C55E'].map(c => (
          <div key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
        ))}
        <div style={{ flex: 1, height: 18, borderRadius: 5, background: 'rgba(244,242,238,0.04)', marginLeft: 8 }} />
      </div>

      {/* Greeting */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 300, color: '#F4F2EE', lineHeight: 1 }}>
          Bonjour, Réseau Lumière
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: 'rgba(200,169,110,0.50)', marginTop: 3, letterSpacing: '0.02em' }}>
          Vue d'ensemble · conformité DIP
        </div>
      </div>

      {/* Stats 4 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
        {[
          { l: 'SECTIONS', v: '10', c: 'rgba(200,169,110,0.85)' },
          { l: 'CONFORMES', v: '7',  c: 'rgba(52,211,153,0.85)' },
          { l: 'À VÉRIF.',  v: '2',  c: 'rgba(251,191,36,0.85)' },
          { l: 'CRITIQUES', v: '1',  c: 'rgba(248,113,113,0.85)' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background: 'rgba(244,242,238,0.02)', border: '0.5px solid rgba(244,242,238,0.06)', borderRadius: 10, padding: '8px 6px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 8, color: 'rgba(244,242,238,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{l}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, fontWeight: 500, color: c, lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Score gauge + section list */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ background: 'rgba(244,242,238,0.02)', border: '0.5px solid rgba(200,169,110,0.10)', borderRadius: 14, padding: '12px 10px', textAlign: 'center', minWidth: 88 }}>
          <svg width="64" height="38" viewBox="0 0 64 38">
            <path d="M 4 34 A 28 28 0 0 1 60 34" stroke="rgba(200,169,110,0.12)" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M 4 34 A 28 28 0 0 1 60 34" stroke="#C8A96E" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="88" strokeDashoffset="26" />
          </svg>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, fontWeight: 500, color: '#C8A96E', marginTop: -4 }}>70%</div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 8, color: 'rgba(244,242,238,0.28)', marginTop: 2 }}>Conformité</div>
        </div>
        <div style={{ flex: 1 }}>
          {[
            { title: 'Présentation franchiseur', c: '#34D399' },
            { title: 'Situation financière',     c: '#34D399' },
            { title: 'État du marché',            c: '#FBBF24' },
            { title: 'Réseaux franchisés',        c: '#F87171' },
          ].map(({ title, c }) => (
            <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 7, background: 'rgba(244,242,238,0.015)', marginBottom: 3 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: c, flexShrink: 0 }} />
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(244,242,238,0.58)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI alert */}
      <div style={{ background: 'rgba(200,169,110,0.05)', border: '0.5px solid rgba(200,169,110,0.18)', borderRadius: 10, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11 }}>✦</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, fontWeight: 500, color: 'rgba(244,242,238,0.85)' }}>1 correction IA disponible</div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 8, color: 'rgba(244,242,238,0.36)', marginTop: 1 }}>Section 4 — Réseaux franchisés</div>
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 8, color: '#C8A96E', background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.22)', borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}>Voir →</div>
      </div>
    </div>
  );
}

// ─── Attestation mockup ───────────────────────────────────────────────────────

function AttestationMockup() {
  return (
    <div style={{ background: 'rgba(8,8,8,0.97)', borderRadius: 16, border: '0.5px solid rgba(200,169,110,0.22)', padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
      <div style={{ borderBottom: '0.5px solid rgba(200,169,110,0.20)', paddingBottom: 14, marginBottom: 16 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(200,169,110,0.60)', marginBottom: 4 }}>ATTESTATION DE MODIFICATION</div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, color: '#F4F2EE' }}>DIPpro — certificat numérique</div>
      </div>

      {[
        { label: 'Effectué le', value: '11 juin 2026 à 14:32', },
        { label: 'Par', value: 'Réseau Lumière SAS', },
        { label: 'SHA-256', value: 'a3f7c8...9e12b4', mono: true },
        { label: 'Score conformité', value: '94 %', gold: true },
      ].map(({ label, value, mono, gold }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '0.5px solid rgba(244,242,238,0.04)' }}>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(244,242,238,0.38)' }}>{label}</span>
          <span style={{
            fontFamily: mono ? 'DM Mono, monospace' : 'DM Sans, sans-serif',
            fontSize: 10,
            color: gold ? '#C8A96E' : '#F4F2EE',
          }}>{value}</span>
        </div>
      ))}

      <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(34,197,94,0.06)', border: '0.5px solid rgba(34,197,94,0.20)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CheckCircle style={{ width: 10, height: 10, color: '#34D399' }} />
        </div>
        <div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: '#34D399', fontWeight: 500 }}>3 franchisés notifiés · PDF envoyé</div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 8, color: 'rgba(244,242,238,0.35)', marginTop: 1 }}>Lien public vérifiable</div>
        </div>
      </div>
    </div>
  );
}

// ─── Waitlist form (dark) ─────────────────────────────────────────────────────

function WaitlistFormDark({ onSuccess }) {
  const [form, setForm] = useState({ email: '', company_name: '', phone: '', message: '' });
  const [rgpd, setRgpd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.company_name) { setError('Email et nom de société sont requis.'); return; }
    if (!rgpd) { setError('Veuillez accepter la politique de confidentialité.'); return; }
    setLoading(true);
    try {
      const res = await api.post('/waitlist', { ...form, source: 'standalone' });
      if (res.data.already_exists) setAlreadyExists(true);
      else { setSuccess(true); onSuccess?.(); }
    } catch (err) {
      setError(err.response?.data?.error || 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const inputS = {
    background: 'rgba(244,242,238,0.04)',
    border: '0.5px solid rgba(244,242,238,0.12)',
    color: '#F4F2EE',
    width: '100%',
    padding: '12px 16px',
    borderRadius: 10,
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 14,
    outline: 'none',
    transition: 'border 0.2s',
    boxSizing: 'border-box',
  };

  if (success || alreadyExists) {
    return (
      <div style={{ textAlign: 'center', padding: '36px 0' }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <CheckCircle style={{ width: 32, height: 32, color: GOLD }} />
        </div>
        <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 30, fontWeight: 300, color: '#F4F2EE', marginBottom: 12 }}>
          {success ? "Vous êtes sur la liste !" : "Déjà inscrit !"}
        </h3>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(244,242,238,0.52)', lineHeight: 1.75, marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
          {success
            ? `Inscription enregistrée pour ${form.email}. Notre équipe vous contactera en priorité dès l'ouverture de l'accès.`
            : `${form.email} est déjà sur notre liste d'attente — vous serez contacté très prochainement.`}
        </p>
        <a href="mailto:theo@iralink-agency.com" style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: GOLD, display: 'block' }}>
          theo@iralink-agency.com
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(244,242,238,0.45)', display: 'block', marginBottom: 6 }}>
            Société / Enseigne <span style={{ color: '#F87171' }}>*</span>
          </label>
          <input type="text" value={form.company_name} onChange={e => set('company_name', e.target.value)}
            placeholder="Ma Franchise SAS" required style={inputS}
            onFocus={e => (e.target.style.border = '0.5px solid rgba(200,169,110,0.55)')}
            onBlur={e => (e.target.style.border = '0.5px solid rgba(244,242,238,0.12)')} />
        </div>
        <div>
          <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(244,242,238,0.45)', display: 'block', marginBottom: 6 }}>
            Téléphone <span style={{ color: 'rgba(244,242,238,0.25)' }}>(optionnel)</span>
          </label>
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
            placeholder="+33 6 12 34 56 78" style={inputS}
            onFocus={e => (e.target.style.border = '0.5px solid rgba(200,169,110,0.55)')}
            onBlur={e => (e.target.style.border = '0.5px solid rgba(244,242,238,0.12)')} />
        </div>
      </div>

      <div>
        <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(244,242,238,0.45)', display: 'block', marginBottom: 6 }}>
          Adresse email <span style={{ color: '#F87171' }}>*</span>
        </label>
        <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
          placeholder="vous@entreprise.fr" required autoComplete="email" style={inputS}
          onFocus={e => (e.target.style.border = '0.5px solid rgba(200,169,110,0.55)')}
          onBlur={e => (e.target.style.border = '0.5px solid rgba(244,242,238,0.12)')} />
      </div>

      <div>
        <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(244,242,238,0.45)', display: 'block', marginBottom: 6 }}>
          Message <span style={{ color: 'rgba(244,242,238,0.25)' }}>(optionnel)</span>
        </label>
        <textarea value={form.message} onChange={e => set('message', e.target.value)} rows={3}
          placeholder="Parlez-nous de votre réseau, de vos besoins DIP..."
          style={{ ...inputS, resize: 'none' }}
          onFocus={e => (e.target.style.border = '0.5px solid rgba(200,169,110,0.55)')}
          onBlur={e => (e.target.style.border = '0.5px solid rgba(244,242,238,0.12)')} />
      </div>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
        <div
          onClick={() => setRgpd(v => !v)}
          style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${rgpd ? GOLD : 'rgba(244,242,238,0.18)'}`, background: rgpd ? GOLD : 'transparent', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          {rgpd && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(244,242,238,0.40)', lineHeight: 1.6 }}>
          J&apos;accepte que mes données soient utilisées pour me contacter au sujet de DIPpro.
          {' '}<Link to="/privacy" style={{ color: GOLD }}>Politique de confidentialité</Link>.
        </span>
      </label>

      {error && (
        <div style={{ borderRadius: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.22)', color: '#F87171', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !form.email || !form.company_name || !rgpd}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '15px 24px', borderRadius: 12, border: 'none',
          cursor: loading || !form.email || !form.company_name || !rgpd ? 'not-allowed' : 'pointer',
          background: form.email && form.company_name && rgpd ? GOLD : 'rgba(200,169,110,0.25)',
          color: form.email && form.company_name && rgpd ? '#080808' : 'rgba(200,169,110,0.55)',
          fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600,
          boxShadow: form.email && form.company_name && rgpd ? '0 6px 24px rgba(200,169,110,0.28)' : 'none',
          transition: 'all 0.2s',
        }}
      >
        {loading
          ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(8,8,8,0.4)', borderTopColor: '#080808', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Inscription…</>
          : <><Send style={{ width: 16, height: 16 }} /> M&apos;inscrire sur la liste d&apos;attente</>}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function LandingPage() {
  const formRef = useRef(null);
  const [waitlistCount, setWaitlistCount] = useState(null);
  const [formDone, setFormDone] = useState(false);

  useEffect(() => {
    api.get('/waitlist/count').then(r => setWaitlistCount(r.data?.count)).catch(() => {});
  }, []);

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const btnGold = {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    background: GOLD, color: '#080808',
    fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600,
    padding: '14px 28px', borderRadius: 12,
    cursor: 'pointer', border: 'none', textDecoration: 'none',
    boxShadow: '0 4px 20px rgba(200,169,110,0.30)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  };

  const btnGhost = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'rgba(244,242,238,0.05)', border: '0.5px solid rgba(244,242,238,0.14)',
    color: 'rgba(244,242,238,0.65)',
    fontFamily: 'DM Sans, sans-serif', fontSize: 14,
    padding: '14px 24px', borderRadius: 12,
    cursor: 'pointer', textDecoration: 'none', transition: 'background 0.15s',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Comment utiliser DIPpro pour gérer son DIP franchise',
    description: 'Gérez la conformité de votre DIP franchise en 3 étapes grâce à DIPpro.',
    step: HOW_STEPS.map(({ num, title, desc }) => ({
      '@type': 'HowToStep',
      position: parseInt(num),
      name: title,
      text: desc,
    })),
  };

  return (
    <>
      <Helmet>
        <title>DIPpro — Gestion légale du DIP pour franchiseurs</title>
        <meta name="description" content="DIPpro automatise la gestion légale du Document d'Information Précontractuelle. Score de conformité Loi Doubin en 30 secondes, attestation PDF certifiée SHA-256, alertes réglementaires automatiques. Pour franchiseurs français." />
        <link rel="canonical" href="https://dippro.business/" />
        <meta property="og:url" content="https://dippro.business/" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
      </Helmet>
    <div className="min-h-screen" style={DARK_BG}>

      {/* ── HEADER ───────────────────────────────────────────── */}
      <header style={{ background: 'rgba(8,8,8,0.72)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '0.5px solid rgba(200,169,110,0.14)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(200,169,110,0.12)', border: '0.5px solid rgba(200,169,110,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield style={{ width: 16, height: 16, color: GOLD }} />
            </div>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#F4F2EE' }}>DIPpro</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(244,242,238,0.28)' }}>by Iralink</span>
          </div>

          {/* Nav desktop */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }} className="hidden md:flex">
            {[['#comment', 'Comment ça marche'], ['#fonctionnalites', 'Fonctionnalités'], ['#faq', 'FAQ']].map(([href, label]) => (
              <a key={href} href={href} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(244,242,238,0.42)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.target.style.color = '#F4F2EE')}
                onMouseLeave={e => (e.target.style.color = 'rgba(244,242,238,0.42)')}>
                {label}
              </a>
            ))}
          </nav>

          {/* Right CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(244,242,238,0.40)', textDecoration: 'none' }}
              className="hidden sm:block">
              Connexion
            </Link>
            <button onClick={scrollToForm} style={btnGold}>
              Liste d&apos;attente <ArrowRight style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px 56px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, alignItems: 'center' }} className="lg:flex-row lg:gap-16 lg:items-center">

          {/* Texte */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <FadeIn>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 20, background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.28)', marginBottom: 28 }}>
                <CheckCircle style={{ width: 13, height: 13, color: GOLD }} />
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: GOLD }}>
                  MVP lancé · Accès anticipé ouvert
                  {waitlistCount != null && waitlistCount > 0 && (
                    <> · <span style={{ color: '#F4F2EE' }}>{waitlistCount} inscrits</span></>
                  )}
                </span>
              </div>

              <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: 'clamp(2.5rem, 5.5vw, 4rem)', color: '#F4F2EE', lineHeight: 1.07, marginBottom: 22 }}>
                Votre DIP toujours conforme.<br />
                <span style={{ color: GOLD }}>Automatiquement.</span>
              </h1>

              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 16, color: 'rgba(244,242,238,0.52)', lineHeight: 1.7, maxWidth: 460, marginBottom: 36 }}>
                L&apos;IA qui analyse, génère et certifie votre Document d&apos;Information Précontractuelle
                en conformité avec la Loi Doubin — Art. L.330-3 du Code de commerce.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
                <button onClick={scrollToForm} style={btnGold}>
                  <Send style={{ width: 16, height: 16 }} />
                  Rejoindre la liste d&apos;attente
                </button>
                <a href="#comment" style={btnGhost}>
                  Voir comment ça marche
                </a>
              </div>

              {/* Trust badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                {['Loi Doubin 1989', 'Art. L.330-3', 'RGPD conforme', 'Hébergé en France'].map(b => (
                  <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(244,242,238,0.35)' }}>
                    <CheckCircle style={{ width: 13, height: 13, color: '#34D399', flexShrink: 0 }} />
                    {b}
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>

          {/* Mockup */}
          <div style={{ width: '100%', maxWidth: 440, flexShrink: 0 }}>
            <FadeIn delay={180}>
              <DashboardMockup />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 64px' }}>
        <FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1, borderRadius: 20, overflow: 'hidden', border: '0.5px solid rgba(200,169,110,0.14)', background: 'rgba(200,169,110,0.08)' }}>
            {[
              { val: '200 000 €', label: 'coût moyen d\'un litige DIP', icon: AlertTriangle, iconColor: '#F87171' },
              { val: '20 jours', label: 'délai légal avant signature', icon: Clock, iconColor: GOLD },
              { val: '10', label: 'sections réglementaires analysées', icon: FileText, iconColor: GOLD },
              { val: '30 s', label: 'pour une analyse complète IA', icon: Sparkles, iconColor: '#34D399' },
            ].map(({ val, label, icon: Icon, iconColor }) => (
              <div key={val} style={{ background: 'rgba(8,8,8,0.80)', padding: '28px 24px', textAlign: 'center' }}>
                <Icon style={{ width: 18, height: 18, color: iconColor, margin: '0 auto 12px' }} />
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 300, color: '#F4F2EE', lineHeight: 1 }}>{val}</div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(244,242,238,0.38)', marginTop: 6, lineHeight: 1.5 }}>{label}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── URGENCE LÉGALE ───────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 72px' }}>
        <FadeIn>
          <div style={{ borderRadius: 22, padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 24, background: 'rgba(239,68,68,0.05)', border: '0.5px solid rgba(239,68,68,0.22)' }} className="md:flex-row md:items-center">
            <div style={{ flex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(239,68,68,0.10)', border: '0.5px solid rgba(239,68,68,0.22)', marginBottom: 16 }}>
                <AlertTriangle style={{ width: 12, height: 12, color: '#F87171' }} />
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#F87171' }}>Jurisprudence récente</span>
              </div>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: '#F4F2EE', lineHeight: 1.1, marginBottom: 14 }}>
                Arrêt Cour de cassation — 26 juin 2024
              </h2>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(244,242,238,0.50)', lineHeight: 1.7, maxWidth: 520 }}>
                La Cour de cassation a confirmé la nullité de contrats de franchise pour DIP incomplet ou inexact.
                Un seul article manquant suffit à exposer votre réseau entier.
              </p>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', color: '#F87171', lineHeight: 1 }}>
                200 000€
              </div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(244,242,238,0.38)', marginTop: 4 }}>
                coût moyen d&apos;un litige DIP
              </div>
              <button onClick={scrollToForm} style={{ ...btnGold, marginTop: 20, padding: '12px 22px', fontSize: 13 }}>
                Protégez votre réseau
              </button>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── COMMENT ÇA MARCHE ────────────────────────────────── */}
      <section id="comment" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: 'clamp(2rem, 4vw, 2.8rem)', color: '#F4F2EE', marginBottom: 12 }}>
              Comment ça marche
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'rgba(244,242,238,0.42)' }}>
              De l&apos;import à la certification — sans intervention manuelle.
            </p>
          </div>
        </FadeIn>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {HOW_STEPS.map(({ num, icon: Icon, title, desc }, i) => (
            <FadeIn key={num} delay={i * 80}>
              <div style={{ borderRadius: 22, padding: '32px 28px', background: 'rgba(200,169,110,0.03)', border: '0.5px solid rgba(200,169,110,0.11)', position: 'relative', overflow: 'hidden', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: '4.5rem', color: 'rgba(200,169,110,0.15)', lineHeight: 1, marginBottom: 20 }}>{num}</div>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <Icon style={{ width: 18, height: 18, color: GOLD }} />
                </div>
                <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 16, color: '#F4F2EE', marginBottom: 10 }}>{title}</h3>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(244,242,238,0.45)', lineHeight: 1.7 }}>{desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── FONCTIONNALITÉS ──────────────────────────────────── */}
      <section id="fonctionnalites" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: 'clamp(2rem, 4vw, 2.8rem)', color: '#F4F2EE', marginBottom: 12 }}>
              Tout ce dont vous avez besoin
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'rgba(244,242,238,0.42)', maxWidth: 480, margin: '0 auto' }}>
              Développé avec des juristes spécialisés en droit de la franchise française.
            </p>
          </div>
        </FadeIn>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <FadeIn key={title} delay={i * 55}>
              <div style={{ borderRadius: 18, padding: '22px 24px', background: 'rgba(244,242,238,0.025)', border: '0.5px solid rgba(244,242,238,0.07)', display: 'flex', gap: 16, alignItems: 'flex-start', transition: 'border 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.border = '0.5px solid rgba(200,169,110,0.22)')}
                onMouseLeave={e => (e.currentTarget.style.border = '0.5px solid rgba(244,242,238,0.07)')}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 18, height: 18, color: GOLD }} />
                </div>
                <div>
                  <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: '#F4F2EE', marginBottom: 6 }}>{title}</h3>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12.5, color: 'rgba(244,242,238,0.42)', lineHeight: 1.65 }}>{desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── ATTESTATION SPOTLIGHT ─────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
        <FadeIn>
          <div style={{ borderRadius: 28, padding: '48px 40px', background: 'rgba(200,169,110,0.04)', border: '0.5px solid rgba(200,169,110,0.16)', display: 'flex', flexDirection: 'column', gap: 40, alignItems: 'center' }} className="md:flex-row md:gap-16">
            <div style={{ flex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.22)', marginBottom: 20 }}>
                <FileCheck style={{ width: 12, height: 12, color: GOLD }} />
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: GOLD }}>Nouveau · Attestation certifiée</span>
              </div>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', color: '#F4F2EE', lineHeight: 1.1, marginBottom: 16 }}>
                Preuve de remise incontestable
              </h2>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(244,242,238,0.50)', lineHeight: 1.75, marginBottom: 24 }}>
                Chaque modification de votre DIP génère automatiquement un certificat PDF horodaté
                avec empreinte SHA-256. Un lien public vérifiable — par vos franchisés, leurs avocats
                ou le tribunal — sans authentification.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Certificat PDF horodaté et signé cryptographiquement',
                  'Lien public accessible sans compte',
                  'Notification email automatique à tous vos franchisés',
                  'Archivage permanent — preuve légale en cas de litige',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <CheckCircle style={{ width: 15, height: 15, color: '#34D399', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(244,242,238,0.55)', lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ width: '100%', maxWidth: 340, flexShrink: 0 }}>
              <AttestationMockup />
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── WAITLIST FORM ────────────────────────────────────── */}
      <section ref={formRef} style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 88px' }}>
        <FadeIn>
          <div style={{ borderRadius: 28, padding: '48px 40px', background: 'rgba(244,242,238,0.025)', border: '0.5px solid rgba(200,169,110,0.22)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 20, background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.22)', marginBottom: 20 }}>
                <Star style={{ width: 12, height: 12, color: GOLD }} />
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: GOLD }}>
                  Accès anticipé · places limitées
                  {waitlistCount != null && waitlistCount > 0 && (
                    <> · {waitlistCount} inscrits</>
                  )}
                </span>
              </div>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', color: '#F4F2EE', marginBottom: 12 }}>
                Rejoignez la liste d&apos;attente
              </h2>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13.5, color: 'rgba(244,242,238,0.45)', lineHeight: 1.7 }}>
                DIPpro ouvrira ses accès dès la constitution d&apos;Iralink Agency.
                Inscrivez-vous pour être contacté en priorité,
                bénéficier du tarif préférentiel Early Adopter et d&apos;un onboarding personnalisé.
              </p>
            </div>

            <WaitlistFormDark onSuccess={() => setFormDone(true)} />

            {/* Footer form */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '0.5px solid rgba(200,169,110,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 18 }}>
                {[['🔒', 'Données confidentielles'], ['🇫🇷', 'Hébergé en France'], ['✉', 'Zéro spam']].map(([icon, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif', fontSize: 11.5, color: 'rgba(244,242,238,0.28)' }}>
                    <span>{icon}</span> {label}
                  </div>
                ))}
              </div>
              <Link to="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: GOLD, textDecoration: 'none' }}>
                Déjà un compte ? →
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 88px' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: 'clamp(2rem, 4vw, 2.6rem)', color: '#F4F2EE' }}>
              Questions fréquentes
            </h2>
          </div>
          <div style={{ borderRadius: 22, padding: '8px 32px', background: 'rgba(244,242,238,0.02)', border: '0.5px solid rgba(244,242,238,0.07)' }}>
            {FAQS.map(({ q, a }) => <FAQItem key={q} q={q} a={a} />)}
          </div>
        </FadeIn>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 88px' }}>
        <FadeIn>
          <div style={{ borderRadius: 28, padding: '60px 48px', textAlign: 'center', background: 'rgba(200,169,110,0.05)', border: '0.5px solid rgba(200,169,110,0.20)' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: 'clamp(2rem, 4vw, 2.8rem)', color: '#F4F2EE', lineHeight: 1.1, marginBottom: 16 }}>
              Votre réseau mérite<br />mieux que l&apos;approximation.
            </h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(244,242,238,0.42)', lineHeight: 1.7, maxWidth: 440, margin: '0 auto 32px' }}>
              Première analyse offerte. Aucune carte bancaire. Onboarding personnalisé inclus.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              <button onClick={scrollToForm} style={{ ...btnGold, fontSize: 15, padding: '16px 36px' }}>
                Rejoindre la liste d&apos;attente
                <ArrowRight style={{ width: 18, height: 18 }} />
              </button>
              <a href="mailto:theo@iralink-agency.com" style={{ ...btnGhost, fontSize: 13 }}>
                Contacter l&apos;équipe
              </a>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer style={{ borderTop: '0.5px solid rgba(200,169,110,0.10)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Shield style={{ width: 16, height: 16, color: GOLD }} />
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: '#F4F2EE' }}>DIPpro</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(244,242,238,0.25)' }}>by Iralink-Agency</span>
              </div>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(244,242,238,0.28)', lineHeight: 1.6, maxWidth: 260 }}>
                Outil SaaS de conformité DIP pour les franchiseurs.
                Développé par Iralink-Agency — société en cours de création.
              </p>
            </div>

            {/* Links */}
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, color: 'rgba(244,242,238,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Produit</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[['#fonctionnalites', 'Fonctionnalités'], ['#comment', 'Comment ça marche'], ['#faq', 'FAQ']].map(([href, label]) => (
                    <a key={href} href={href} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(244,242,238,0.32)', textDecoration: 'none' }}
                      onMouseEnter={e => (e.target.style.color = 'rgba(244,242,238,0.65)')}
                      onMouseLeave={e => (e.target.style.color = 'rgba(244,242,238,0.32)')}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, color: 'rgba(244,242,238,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Légal</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[['/privacy', 'Confidentialité'], ['/cgu', 'CGU'], ['/mentions-legales', 'Mentions légales']].map(([to, label]) => (
                    <Link key={to} to={to} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(244,242,238,0.32)', textDecoration: 'none' }}
                      onMouseEnter={e => (e.target.style.color = 'rgba(244,242,238,0.65)')}
                      onMouseLeave={e => (e.target.style.color = 'rgba(244,242,238,0.32)')}>
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, color: 'rgba(244,242,238,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Contact</div>
                <a href="mailto:theo@iralink-agency.com" style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: GOLD, textDecoration: 'none', display: 'block', marginBottom: 8 }}>
                  theo@iralink-agency.com
                </a>
                <Link to="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(244,242,238,0.32)', textDecoration: 'none' }}>
                  Connexion
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div style={{ paddingTop: 20, borderTop: '0.5px solid rgba(244,242,238,0.05)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(244,242,238,0.20)' }}>
              © {new Date().getFullYear()} Iralink-Agency — Société en cours de création · DIPpro
            </span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(244,242,238,0.15)' }}>
              Loi Doubin Art. L.330-3 · Décret 91-337 · RGPD
            </span>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
