import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield, CheckCircle, FileText, Bell, Users, Download, Zap, ArrowRight,
  ChevronDown, TrendingUp, Lock, Sparkles, AlertTriangle,
  GitBranch, Search, PenTool, ClipboardCheck, Archive, Plug
} from 'lucide-react';

const VITE_CAL_URL = import.meta.env.VITE_CAL_COM_URL || 'https://cal.com/theo-coutard-mhdsix/call-clients';

const FEATURES = [
  { icon: Sparkles,   title: 'Analyse IA en 30 s',        desc: 'Claude Opus analyse les 10 sections Loi Doubin et génère un score de conformité instantané.' },
  { icon: Shield,     title: 'Génération guidée',          desc: 'Formulaire en 8 étapes. L\'IA rédige un DIP complet, conforme Art. L.330-3.' },
  { icon: Bell,       title: 'Alertes automatiques',       desc: 'Rappels 90, 30 et 7 jours avant l\'expiration annuelle obligatoire.' },
  { icon: Zap,        title: 'Détection des changements',  desc: 'Chaque modification légale à notifier sous 20 jours est identifiée automatiquement.' },
  { icon: Users,      title: 'Portail franchisé',          desc: 'Lien sécurisé, accusé de réception horodaté, signature électronique.' },
  { icon: Download,   title: 'Export DOCX & PDF',          desc: 'DIP reformulé et rapport de conformité prêts pour signature et archivage.' },
  { icon: TrendingUp, title: 'Score en temps réel',        desc: 'Tableau de bord, historique des versions, plan d\'action prioritaire.' },
  { icon: Lock,       title: 'Sécurité RGPD',              desc: 'Hébergé en France, ISO 27001, chiffrement bout en bout, audit log.' },
];

const HOW_STEPS = [
  { num: '01', icon: Plug,           title: 'Connexion',    desc: 'Importez votre DIP existant ou connectez votre espace de stockage.' },
  { num: '02', icon: Search,         title: 'Surveillance', desc: 'L\'IA monitore en continu votre réseau et les évolutions légales.' },
  { num: '03', icon: AlertTriangle,  title: 'Détection',    desc: 'Chaque écart réglementaire est détecté et qualifié automatiquement.' },
  { num: '04', icon: PenTool,        title: 'Rédaction',    desc: 'Une version corrigée est proposée par l\'IA, prête à valider.' },
  { num: '05', icon: ClipboardCheck, title: 'Validation',   desc: 'Vous approuvez en un clic — ou laissez l\'automatisation agir.' },
  { num: '06', icon: Archive,        title: 'Archivage',    desc: 'Chaque version est horodatée, traçable et exportable.' },
];

const FAQS = [
  { q: 'Qu\'est-ce que le DIP ?', a: 'Document obligatoire (Art. L.330-3 Code de commerce). Tout franchiseur doit le remettre au candidat franchisé 20 jours avant la signature. Son absence ou son inexactitude entraîne la nullité du contrat.' },
  { q: 'DIPpro remplace-t-il un avocat ?', a: 'Non. DIPpro structure, vérifie et prépare le travail — votre avocat valide. Notre rapport de conformité divise généralement par 3 le temps de révision juridique.' },
  { q: 'Mes données sont-elles sécurisées ?', a: 'Oui. Hébergement exclusif en Europe (Supabase, ISO 27001 / SOC 2), JWT + Row Level Security, audit log immuable, plein RGPD.' },
  { q: 'Quel est l\'accès anticipé ?', a: 'Le MVP est lancé. Les premiers franchiseurs accèdent à toutes les fonctionnalités en échange d\'un retour structuré. Aucune carte bancaire requise.' },
];

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function FadeIn({ children, delay = 0, className = '' }) {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} className={className} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`
    }}>
      {children}
    </div>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '0.5px solid rgba(200,169,110,0.15)' }}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between py-5 text-left gap-4">
        <span className="font-dm-sans text-sm font-medium" style={{ color: '#F4F2EE' }}>{q}</span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: '#C8A96E', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="pb-5">
          <p className="font-dm-sans text-sm leading-relaxed" style={{ color: 'rgba(244,242,238,0.55)' }}>{a}</p>
        </div>
      )}
    </div>
  );
}

function DashboardMockup() {
  return (
    <div style={{
      background: 'rgba(8,8,8,0.95)',
      borderRadius: 20,
      border: '0.5px solid rgba(200,169,110,0.22)',
      padding: '20px',
      boxShadow: '0 40px 100px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(200,169,110,0.10)',
      width: '100%',
    }}>
      {/* Barre titre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444' }} />
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FBBF24' }} />
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} />
        <div style={{ flex: 1, height: 18, borderRadius: 5, background: 'rgba(244,242,238,0.05)', marginLeft: 8 }} />
      </div>

      {/* Greeting */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 300, color: '#F4F2EE', lineHeight: 1 }}>Bonjour, Réseau Lumière</div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(200,169,110,0.50)', marginTop: 3, letterSpacing: '0.02em' }}>Vue d'ensemble · conformité DIP</div>
      </div>

      {/* Stats 4 cartes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
        {[
          { l: 'SECTIONS', v: '10', c: 'rgba(200,169,110,0.85)' },
          { l: 'CONFORMES', v: '7',  c: 'rgba(52,211,153,0.85)'  },
          { l: 'À VÉRIF.',  v: '2',  c: 'rgba(251,191,36,0.85)'  },
          { l: 'CRITIQUES', v: '1',  c: 'rgba(248,113,113,0.85)' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background: 'rgba(244,242,238,0.02)', border: '0.5px solid rgba(244,242,238,0.06)', borderRadius: 10, padding: '8px 6px' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 8, color: 'rgba(244,242,238,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{l}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, fontWeight: 500, color: c, lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Gauge + sections */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ background: 'rgba(244,242,238,0.02)', border: '0.5px solid rgba(200,169,110,0.10)', borderRadius: 14, padding: '12px 10px', textAlign: 'center', minWidth: 90 }}>
          <svg width="64" height="38" viewBox="0 0 64 38">
            <path d="M 4 34 A 28 28 0 0 1 60 34" stroke="rgba(200,169,110,0.12)" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M 4 34 A 28 28 0 0 1 60 34" stroke="#C8A96E" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="88" strokeDashoffset="26" />
          </svg>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, fontWeight: 500, color: '#C8A96E', marginTop: -4 }}>70%</div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 8, color: 'rgba(244,242,238,0.30)', marginTop: 2 }}>Conformité</div>
        </div>
        <div style={{ flex: 1 }}>
          {[
            { title: 'Présentation franchiseur', c: '#34D399' },
            { title: 'Situation financière',     c: '#34D399' },
            { title: 'État du marché',            c: '#FBBF24' },
            { title: 'Réseaux franchisés',        c: '#F87171' },
          ].map(({ title, c }) => (
            <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 7, background: 'rgba(244,242,238,0.015)', marginBottom: 3, border: '0.5px solid rgba(244,242,238,0.04)' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: c, flexShrink: 0 }} />
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(244,242,238,0.60)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerte IA */}
      <div style={{ background: 'rgba(200,169,110,0.05)', border: '0.5px solid rgba(200,169,110,0.18)', borderRadius: 10, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11 }}>✦</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, fontWeight: 500, color: 'rgba(244,242,238,0.85)' }}>1 correction IA disponible</div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 8, color: 'rgba(244,242,238,0.38)', marginTop: 1 }}>Section 4 — Réseaux franchisés</div>
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 8, color: '#C8A96E', background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.22)', borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}>Voir →</div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  const darkBg = {
    background: `
      radial-gradient(ellipse 55% 50% at 15% 70%, rgba(200,169,110,0.18) 0%, transparent 60%),
      radial-gradient(ellipse 40% 60% at 80% 20%, rgba(180,140,70,0.12) 0%, transparent 55%),
      radial-gradient(ellipse 60% 40% at 60% 85%, rgba(140,100,40,0.08) 0%, transparent 60%),
      linear-gradient(160deg, #0a0805 0%, #0f0d08 25%, #080808 55%, #060606 100%)`
  };

  return (
    <div className="min-h-screen" style={darkBg}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header style={{ background: 'rgba(8,8,8,0.72)', backdropFilter: 'blur(24px)', borderBottom: '0.5px solid rgba(200,169,110,0.14)' }} className="sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="lg-logo-brand-pill">
              <div className="lg-logo-brand-icon">D</div>
              <span className="lg-logo-brand-text">DIPpro</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            {[['#comment', 'Comment ça marche'], ['#fonctionnalites', 'Fonctionnalités'], ['#faq', 'FAQ']].map(([href, label]) => (
              <a key={href} href={href} className="font-dm-sans text-sm transition-colors" style={{ color: 'rgba(244,242,238,0.45)' }}
                onMouseEnter={e => (e.target.style.color = '#F4F2EE')} onMouseLeave={e => (e.target.style.color = 'rgba(244,242,238,0.45)')}>
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="font-dm-sans text-sm px-4 py-2 rounded-lg hidden sm:block transition-colors" style={{ color: 'rgba(244,242,238,0.45)' }}>
              Connexion
            </Link>
            <a href={VITE_CAL_URL} target="_blank" rel="noopener noreferrer"
              className="font-dm-sans text-sm px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all"
              style={{ background: '#C8A96E', color: '#080808' }}>
              Démo gratuite
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Texte */}
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 font-dm-mono text-xs"
              style={{ background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.28)', color: '#C8A96E' }}>
              <CheckCircle className="w-3.5 h-3.5" />
              Loi Doubin · Art. L.330-3 · Conformité IA
            </div>

            <h1 className="font-cormorant font-light mb-5"
              style={{ color: '#F4F2EE', lineHeight: 1.08, fontSize: 'clamp(2.4rem, 5vw, 4rem)' }}>
              Votre DIP toujours conforme.<br />
              <span style={{ color: '#C8A96E' }}>Automatiquement.</span>
            </h1>

            <p className="font-dm-sans mb-10" style={{ color: 'rgba(244,242,238,0.55)', fontSize: 16, lineHeight: 1.6, maxWidth: 480 }}>
              DIPpro surveille votre réseau et met à jour votre DIP en temps réel.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href={VITE_CAL_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 font-dm-sans font-medium transition-all"
                style={{ background: '#C8A96E', color: '#080808', padding: '14px 28px', borderRadius: 12, fontSize: 14, whiteSpace: 'nowrap' }}>
                Demander une démo gratuite
                <ArrowRight className="w-4 h-4" />
              </a>
              <a href="#comment"
                className="inline-flex items-center justify-center gap-2 font-dm-sans transition-all"
                style={{ background: 'rgba(244,242,238,0.05)', border: '0.5px solid rgba(244,242,238,0.14)', color: 'rgba(244,242,238,0.65)', padding: '14px 24px', borderRadius: 12, fontSize: 14, whiteSpace: 'nowrap' }}>
                Voir comment ça marche
              </a>
            </div>
          </div>

          {/* Mockup */}
          <div className="w-full lg:w-[440px] flex-shrink-0">
            <FadeIn delay={200}>
              <DashboardMockup />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── POURQUOI MAINTENANT ─────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <FadeIn>
          <div className="rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-start gap-8"
            style={{ background: 'rgba(239,68,68,0.05)', border: '0.5px solid rgba(239,68,68,0.25)' }}>

            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 font-dm-mono text-xs"
                style={{ background: 'rgba(239,68,68,0.10)', border: '0.5px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
                <AlertTriangle className="w-3 h-3" />
                Jurisprudence récente
              </div>
              <h2 className="font-cormorant font-light mb-3"
                style={{ color: '#F4F2EE', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', lineHeight: 1.1 }}>
                Arrêt Cour de cassation — 26 juin 2024
              </h2>
              <p className="font-dm-sans" style={{ color: 'rgba(244,242,238,0.55)', fontSize: 15, lineHeight: 1.6, maxWidth: 560 }}>
                La Cour de cassation a confirmé la nullité de contrats de franchise pour DIP incomplet ou inexact. Un seul article manquant suffit à exposer votre réseau.
              </p>
            </div>

            <div className="flex-shrink-0 text-center md:text-right">
              <div className="font-cormorant font-light" style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', color: '#F87171', lineHeight: 1 }}>
                200 000€
              </div>
              <div className="font-dm-sans text-sm mt-1" style={{ color: 'rgba(244,242,238,0.45)' }}>
                coût moyen d'un litige DIP
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── COMMENT ÇA MARCHE ──────────────────────────────────── */}
      <section id="comment" className="max-w-6xl mx-auto px-6 pb-24">
        <FadeIn>
          <div className="text-center mb-14">
            <h2 className="font-cormorant font-light mb-3"
              style={{ color: '#F4F2EE', fontSize: 'clamp(2rem, 4vw, 2.5rem)' }}>
              Comment ça marche
            </h2>
            <p className="font-dm-sans" style={{ color: 'rgba(244,242,238,0.45)', fontSize: 15, lineHeight: 1.6 }}>
              De la connexion à l'archivage — sans intervention manuelle.
            </p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {HOW_STEPS.map(({ num, icon: Icon, title, desc }, i) => (
            <FadeIn key={num} delay={i * 60}>
              <div className="rounded-2xl p-6 relative overflow-hidden"
                style={{ background: 'rgba(200,169,110,0.03)', border: '0.5px solid rgba(200,169,110,0.12)' }}>
                <div className="font-cormorant font-light mb-4"
                  style={{ fontSize: '3rem', color: 'rgba(200,169,110,0.18)', lineHeight: 1 }}>
                  {num}
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.22)' }}>
                  <Icon className="w-4.5 h-4.5 text-gold" />
                </div>
                <h3 className="font-dm-sans font-semibold mb-2" style={{ color: '#F4F2EE', fontSize: 15 }}>{title}</h3>
                <p className="font-dm-sans" style={{ color: 'rgba(244,242,238,0.48)', fontSize: 13, lineHeight: 1.6 }}>{desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── FONCTIONNALITÉS ────────────────────────────────────── */}
      <section id="fonctionnalites" className="max-w-6xl mx-auto px-6 pb-24">
        <FadeIn>
          <div className="text-center mb-14">
            <h2 className="font-cormorant font-light mb-3"
              style={{ color: '#F4F2EE', fontSize: 'clamp(2rem, 4vw, 2.5rem)' }}>
              Tout ce dont vous avez besoin
            </h2>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <FadeIn key={title} delay={i * 50}>
              <div className="rounded-2xl p-5 h-full transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(244,242,238,0.03)', border: '0.5px solid rgba(244,242,238,0.07)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(200,169,110,0.10)', border: '0.5px solid rgba(200,169,110,0.20)' }}>
                  <Icon className="w-4 h-4 text-gold" />
                </div>
                <h3 className="font-dm-sans font-semibold mb-1.5" style={{ color: '#F4F2EE', fontSize: 13 }}>{title}</h3>
                <p className="font-dm-sans" style={{ color: 'rgba(244,242,238,0.42)', fontSize: 12, lineHeight: 1.6 }}>{desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── SOCIAL PROOF ───────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <FadeIn>
          <div className="rounded-2xl p-10 text-center"
            style={{ background: 'rgba(200,169,110,0.04)', border: '0.5px solid rgba(200,169,110,0.18)' }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 font-dm-mono text-xs"
              style={{ background: 'rgba(52,211,153,0.10)', border: '0.5px solid rgba(52,211,153,0.25)', color: '#34D399' }}>
              <CheckCircle className="w-3.5 h-3.5" />
              MVP lancé — accès anticipé ouvert
            </div>
            <h2 className="font-cormorant font-light mb-4"
              style={{ color: '#F4F2EE', fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)' }}>
              Rejoignez les premiers franchiseurs
            </h2>
            <p className="font-dm-sans mb-8"
              style={{ color: 'rgba(244,242,238,0.48)', fontSize: 15, lineHeight: 1.6, maxWidth: 460, margin: '0 auto 2rem' }}>
              Accès complet à toutes les fonctionnalités. En échange, votre retour nous aide à construire le meilleur outil du marché.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href={VITE_CAL_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-dm-sans font-medium transition-all"
                style={{ background: '#C8A96E', color: '#080808', padding: '14px 28px', borderRadius: 12, fontSize: 14 }}>
                Demander une démo gratuite
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link to="/register"
                className="inline-flex items-center gap-2 font-dm-sans transition-all"
                style={{ background: 'rgba(244,242,238,0.05)', border: '0.5px solid rgba(244,242,238,0.14)', color: 'rgba(244,242,238,0.65)', padding: '14px 24px', borderRadius: 12, fontSize: 14 }}>
                Créer un compte — c'est gratuit
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section id="faq" className="max-w-3xl mx-auto px-6 pb-24">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="font-cormorant font-light"
              style={{ color: '#F4F2EE', fontSize: 'clamp(2rem, 4vw, 2.5rem)' }}>
              Questions fréquentes
            </h2>
          </div>
          <div className="rounded-2xl p-8"
            style={{ background: 'rgba(244,242,238,0.02)', border: '0.5px solid rgba(244,242,238,0.07)' }}>
            {FAQS.map(({ q, a }) => <FAQItem key={q} q={q} a={a} />)}
          </div>
        </FadeIn>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <FadeIn>
          <div className="rounded-3xl p-12 text-center"
            style={{ background: 'rgba(200,169,110,0.05)', border: '0.5px solid rgba(200,169,110,0.22)' }}>
            <h2 className="font-cormorant font-light mb-4"
              style={{ color: '#F4F2EE', fontSize: 'clamp(2rem, 4vw, 2.8rem)' }}>
              Votre réseau mérite mieux que l'approximation.
            </h2>
            <p className="font-dm-sans mb-8"
              style={{ color: 'rgba(244,242,238,0.48)', fontSize: 15, lineHeight: 1.6, maxWidth: 440, margin: '0 auto 2rem' }}>
              Première analyse offerte. Aucune carte bancaire.
            </p>
            <a href={VITE_CAL_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 font-dm-sans font-medium transition-all"
              style={{ background: '#C8A96E', color: '#080808', padding: '16px 36px', borderRadius: 14, fontSize: 15 }}>
              Demander une démo gratuite
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </FadeIn>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer style={{ borderTop: '0.5px solid rgba(200,169,110,0.12)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-dm-sans text-xs" style={{ color: 'rgba(244,242,238,0.30)' }}>
            © {new Date().getFullYear()} DIPpro
          </p>
          <div className="flex items-center gap-6">
            {[['/legal', 'Mentions légales'], ['/privacy', 'Confidentialité']].map(([to, label]) => (
              <Link key={to} to={to} className="font-dm-sans text-xs transition-colors"
                style={{ color: 'rgba(244,242,238,0.30)' }}>
                {label}
              </Link>
            ))}
            <a href="mailto:theo@iralink-agency.com" className="font-dm-mono text-xs"
              style={{ color: 'rgba(200,169,110,0.55)' }}>
              theo@iralink-agency.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
