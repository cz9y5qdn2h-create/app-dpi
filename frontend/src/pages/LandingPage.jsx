import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield, CheckCircle, FileText, Bell, Users, Download, Zap, ArrowRight,
  Star, ChevronDown, Quote, TrendingUp, Lock, Clock, Sparkles, Play
} from 'lucide-react';
import LiquidGlassBtn from '../components/ui/LiquidGlassBtn';

const FEATURES = [
  { icon: Sparkles, title: 'Analyse IA en 30 secondes', desc: 'Importez votre DIP — Claude Opus analyse les 10 sections Loi Doubin et génère un score de conformité instantané avec recommandations détaillées.' },
  { icon: Shield, title: 'Génération guidée depuis zéro', desc: 'Formulaire intelligent en 8 étapes. L\'IA rédige un DIP complet, structuré, conforme Art. L.330-3 — directement exploitable par vos avocats.' },
  { icon: Bell, title: 'Alertes de renouvellement automatiques', desc: 'Ne ratez plus jamais une échéance. Rappels automatiques 90, 30 et 7 jours avant l\'expiration annuelle obligatoire de votre DIP.' },
  { icon: Zap, title: 'Détection des changements légaux', desc: 'Comparez deux versions de votre DIP. L\'IA identifie chaque modification à notifier légalement aux franchisés sous 20 jours.' },
  { icon: Users, title: 'Portail franchisé sécurisé', desc: 'Partagez un lien sécurisé. Chaque franchisé accède à son DIP en ligne, peut en accuser réception et signer électroniquement.' },
  { icon: Download, title: 'Export DOCX & rapport PDF', desc: 'Téléchargez votre DIP reformulé en DOCX et le rapport de conformité en PDF — prêts pour signature et archivage légal.' },
  { icon: TrendingUp, title: 'Score de conformité en temps réel', desc: 'Tableau de bord avec score global, historique des versions, sections non conformes et plan d\'action prioritaire.' },
  { icon: Lock, title: 'Sécurité & RGPD by design', desc: 'Données hébergées en France sur Supabase (ISO 27001). Chiffrement bout en bout, journaux d\'audit, droit à l\'oubli intégré.' },
];

const STEPS = [
  { num: '01', title: 'Importez ou créez votre DIP', desc: 'Glissez votre PDF/DOCX existant ou remplissez le formulaire guidé. L\'IA extrait et structure le contenu en secondes.', icon: FileText },
  { num: '02', title: 'Obtenez votre score de conformité', desc: 'Diagnostic complet : 10 sections Loi Doubin analysées, score global, points critiques, corrections suggérées par l\'IA.', icon: TrendingUp },
  { num: '03', title: 'Corrigez, exportez et partagez', desc: 'Appliquez les recommandations IA, exportez le DIP corrigé et partagez un lien sécurisé à vos franchisés.', icon: Users },
];

const TESTIMONIALS = [
  { name: 'Sophie M.', role: 'Directrice Franchise — Réseau de 42 points de vente', text: 'Avant DIPpro, notre DIP était une source de stress permanent. Aujourd\'hui, je sais en temps réel si nous sommes conformes. L\'analyse IA nous a évité un contentieux à 80 000€.', rating: 5 },
  { name: 'Thomas B.', role: 'Avocat spécialisé franchise — Paris', text: 'Je recommande DIPpro à tous mes clients franchiseurs. L\'outil identifie des non-conformités que même un juriste peut manquer lors d\'une lecture rapide. Un gain de temps considérable.', rating: 5 },
  { name: 'Claire D.', role: 'Co-fondatrice — Réseau de franchises beauté (18 unités)', text: 'Le portail franchisé est révolutionnaire. Mes franchisés consultent leur DIP en ligne, accusent réception — tout est tracé. Plus de litige sur "je n\'ai pas reçu le document".', rating: 5 },
];

const FAQS = [
  { q: 'Qu\'est-ce que le DIP (Document d\'Information Précontractuelle) ?', a: 'Le DIP est un document obligatoire en France (Art. L.330-3 Code de commerce, Loi Doubin 1989). Tout franchiseur doit le remettre à chaque candidat franchisé au moins 20 jours avant la signature du contrat. Il doit contenir 10 rubriques précises. Son non-respect entraîne la nullité du contrat de franchise.' },
  { q: 'DIPpro est-il conforme à la réglementation française ?', a: 'Oui. DIPpro est conçu spécifiquement pour la Loi Doubin française. Notre système IA vérifie chaque DIP contre les 10 sections obligatoires définies par le décret d\'application du 4 avril 1991. Nos analyses sont alignées avec la jurisprudence française en droit de la franchise.' },
  { q: 'Mes données sont-elles sécurisées ?', a: 'Absolument. Vos données sont hébergées exclusivement en Europe sur Supabase (certifié ISO 27001, SOC 2). L\'accès est protégé par JWT + Row Level Security côté base de données. Chaque action est journalisée dans un audit log immuable. Nous sommes pleinement conformes au RGPD.' },
  { q: 'Combien de temps dure l\'essai gratuit ?', a: 'L\'essai gratuit dure 5 jours avec accès à toutes les fonctionnalités sans restriction — analyse IA, génération de DIP, gestion des franchisés, exports. Aucune carte bancaire requise. À la fin de l\'essai, prenez rendez-vous avec notre équipe pour un accès illimité.' },
  { q: 'L\'IA peut-elle remplacer mon avocat spécialisé franchise ?', a: 'DIPpro est un outil de conformité qui aide à structurer et vérifier votre DIP automatiquement. Il ne remplace pas un conseil juridique humain. Nous recommandons de soumettre le DIP finalisé à un avocat spécialisé pour validation — notre rapport de conformité facilite d\'ailleurs ce travail et réduit leurs honoraires.' },
  { q: 'Comment fonctionne le portail franchisé ?', a: 'Depuis DIPpro, générez un lien sécurisé unique pour votre DIP. Partagez ce lien à vos franchisés par email ou WhatsApp. Ils accèdent au DIP en lecture seule, peuvent l\'accusé de réception avec horodatage légal. Toutes les consultations sont enregistrées dans votre journal d\'audit.' },
];

const STATS = [
  { value: '10', label: 'sections Loi Doubin vérifiées', suffix: '' },
  { value: '30', label: 'secondes pour une analyse complète', suffix: '' },
  { value: '5', label: 'jours d\'essai gratuit', suffix: '' },
  { value: '100', label: 'conformité RGPD garantie', suffix: '%' },
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
      opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`
    }}>
      {children}
    </div>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b" style={{ borderColor: 'rgba(200,169,110,0.15)' }}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between py-5 text-left gap-4">
        <span className="font-dm-sans text-sm font-medium" style={{ color: '#1A1826' }}>{q}</span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: '#C8A96E', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>
      {open && (
        <div className="pb-5">
          <p className="font-dm-sans text-sm leading-relaxed" style={{ color: '#64748B' }}>{a}</p>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #dde2f5 0%, #ebe7fa 40%, #dceaf8 70%, #e3e1f6 100%)' }}>

      {/* HEADER */}
      <header style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(200,169,110,0.18)' }} className="sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.3)' }}>
              <Shield className="w-4 h-4" style={{ color: '#C8A96E' }} />
            </div>
            <div>
              <span className="font-cormorant text-xl" style={{ color: '#1A1826' }}>DIPpro</span>
              <span className="font-dm-mono text-xs ml-2" style={{ color: '#64748B' }}>by Iralink</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            {[['#fonctionnalites', 'Fonctionnalités'], ['#comment', 'Comment ça marche'], ['#tarifs', 'Tarifs'], ['#faq', 'FAQ']].map(([href, label]) => (
              <a key={href} href={href} className="font-dm-sans text-sm transition-colors" style={{ color: '#64748B' }}
                onMouseEnter={e => e.target.style.color = '#1A1826'} onMouseLeave={e => e.target.style.color = '#64748B'}>
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="font-dm-sans text-sm px-4 py-2 rounded-lg transition-colors hidden sm:block" style={{ color: '#64748B' }}>
              Connexion
            </Link>
            <Link to="/register" className="font-dm-sans text-sm px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all hover:shadow-lg" style={{ background: '#C8A96E', color: '#1A1826' }}>
              Essai gratuit
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div style={{ opacity: 1 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 font-dm-mono text-xs" style={{ background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.25)', color: '#C8A96E' }}>
            <Star className="w-3.5 h-3.5" />
            Conforme Loi Doubin — Art. L.330-3 du Code de commerce
          </div>

          <h1 className="font-cormorant font-light mb-6" style={{ color: '#1A1826', lineHeight: 1.08, fontSize: 'clamp(3rem, 7vw, 5rem)' }}>
            Votre DIP,<br />
            <span style={{ color: '#C8A96E' }}>conforme et sans effort.</span>
          </h1>

          <p className="font-dm-sans text-lg max-w-2xl mx-auto mb-10" style={{ color: '#64748B', lineHeight: 1.7 }}>
            DIPpro analyse, génère et met à jour votre Document d'Information Précontractuelle grâce à l'IA. Zéro risque juridique, zéro prise de tête.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <LiquidGlassBtn
              onClick={() => navigate('/register')}
              padding="16px 32px"
              cornerRadius={14}
              displacementScale={80}
              blurAmount={0.12}
              saturation={160}
              aberrationIntensity={2}
              elasticity={0.25}
              mode="prominent"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'DM Sans, sans-serif', fontSize: 15, fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>
                Commencer maintenant — c&apos;est gratuit
                <ArrowRight style={{ width: 20, height: 20 }} />
              </span>
            </LiquidGlassBtn>

            <LiquidGlassBtn
              onClick={() => document.getElementById('comment')?.scrollIntoView({ behavior: 'smooth' })}
              padding="14px 24px"
              cornerRadius={14}
              displacementScale={50}
              blurAmount={0.06}
              saturation={130}
              aberrationIntensity={1}
              elasticity={0.18}
              mode="standard"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>
                <Play style={{ width: 16, height: 16, color: '#C8A96E' }} />
                Voir comment ça marche
              </span>
            </LiquidGlassBtn>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12">
            {['Loi Doubin 1989', 'Art. L.330-3', 'RGPD conforme', 'Données hébergées en France', 'Essai gratuit 5 jours'].map(b => (
              <div key={b} className="flex items-center gap-2 font-dm-sans text-sm" style={{ color: '#64748B' }}>
                <CheckCircle className="w-4 h-4" style={{ color: '#22C55E' }} />
                {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map(({ value, label, suffix }) => (
              <div key={label} className="rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(200,169,110,0.2)' }}>
                <p className="font-cormorant font-light mb-1" style={{ color: '#C8A96E', fontSize: '2.5rem' }}>
                  {value}{suffix}
                </p>
                <p className="font-dm-sans text-xs" style={{ color: '#64748B' }}>{label}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* FEATURES */}
      <section id="fonctionnalites" className="max-w-6xl mx-auto px-6 pb-24">
        <FadeIn>
          <div className="text-center mb-16">
            <h2 className="font-cormorant text-4xl mb-4" style={{ color: '#1A1826' }}>Tout ce dont vous avez besoin</h2>
            <p className="font-dm-sans text-base" style={{ color: '#64748B', maxWidth: 520, margin: '0 auto' }}>
              La conformité DIP est votre responsabilité légale en tant que franchiseur. DIPpro la rend simple, traçable et sans risque.
            </p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <FadeIn key={title} delay={i * 60}>
              <div className="rounded-2xl p-6 h-full transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.2)' }}>
                  <Icon className="w-5 h-5" style={{ color: '#C8A96E' }} />
                </div>
                <h3 className="font-dm-sans text-sm font-semibold mb-2" style={{ color: '#1A1826' }}>{title}</h3>
                <p className="font-dm-sans text-xs leading-relaxed" style={{ color: '#64748B' }}>{desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="comment" className="max-w-6xl mx-auto px-6 pb-24">
        <FadeIn>
          <div className="text-center mb-16">
            <h2 className="font-cormorant text-4xl mb-4" style={{ color: '#1A1826' }}>Opérationnel en 3 étapes</h2>
            <p className="font-dm-sans text-base" style={{ color: '#64748B' }}>De zéro à un DIP conforme en moins de 10 minutes.</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map(({ num, title, desc, icon: Icon }, i) => (
            <FadeIn key={num} delay={i * 120}>
              <div className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+3rem)] w-[calc(100%-3rem)] h-px" style={{ background: 'rgba(200,169,110,0.25)' }} />
                )}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.25)' }}>
                  <Icon className="w-6 h-6" style={{ color: '#C8A96E' }} />
                </div>
                <div className="font-cormorant text-5xl font-light mb-2" style={{ color: 'rgba(200,169,110,0.25)' }}>{num}</div>
                <h3 className="font-dm-sans text-base font-semibold mb-3" style={{ color: '#1A1826' }}>{title}</h3>
                <p className="font-dm-sans text-sm leading-relaxed" style={{ color: '#64748B' }}>{desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="font-cormorant text-4xl mb-4" style={{ color: '#1A1826' }}>Ce qu'ils en disent</h2>
            <p className="font-dm-sans text-base" style={{ color: '#64748B' }}>Franchiseurs et professionnels qui font confiance à DIPpro.</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ name, role, text, rating }, i) => (
            <FadeIn key={name} delay={i * 100}>
              <div className="rounded-2xl p-6 h-full flex flex-col" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', border: '1px solid rgba(200,169,110,0.15)' }}>
                <Quote className="w-6 h-6 mb-4" style={{ color: 'rgba(200,169,110,0.4)' }} />
                <p className="font-dm-sans text-sm leading-relaxed flex-1 mb-4" style={{ color: '#475569' }}>{text}</p>
                <div>
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: rating }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5" style={{ color: '#C8A96E', fill: '#C8A96E' }} />
                    ))}
                  </div>
                  <p className="font-dm-sans text-sm font-semibold" style={{ color: '#1A1826' }}>{name}</p>
                  <p className="font-dm-mono text-xs" style={{ color: '#94A3B8' }}>{role}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="tarifs" className="max-w-6xl mx-auto px-6 pb-24">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="font-cormorant text-4xl mb-4" style={{ color: '#1A1826' }}>Tarification simple et transparente</h2>
            <p className="font-dm-sans text-base" style={{ color: '#64748B' }}>Commencez gratuitement. Évoluez sans surprise.</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Trial */}
          <FadeIn delay={0}>
            <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
              <p className="font-dm-mono text-xs mb-4" style={{ color: '#C8A96E' }}>ESSAI GRATUIT</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="font-cormorant text-5xl font-light" style={{ color: '#1A1826' }}>0€</span>
                <span className="font-dm-sans text-sm" style={{ color: '#64748B' }}> / 5 jours</span>
              </div>
              <p className="font-dm-sans text-sm mb-6" style={{ color: '#64748B' }}>Toutes les fonctionnalités. Aucune carte bancaire.</p>
              <ul className="space-y-2.5 mb-8">
                {['Analyse IA complète (1 DIP)', 'Génération guidée', 'Gestion des franchisés', 'Export DOCX & PDF', 'Portail franchisé (lien de partage)', 'Support Iralink inclus'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#22C55E' }} />
                    <span className="font-dm-sans text-sm" style={{ color: '#475569' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block text-center font-dm-sans text-sm font-medium py-3 rounded-xl transition-all" style={{ border: '1.5px solid #C8A96E', color: '#C8A96E' }}>
                Démarrer l'essai gratuit
              </Link>
            </div>
          </FadeIn>

          {/* Pro */}
          <FadeIn delay={100}>
            <div className="rounded-2xl p-8 relative overflow-hidden" style={{ background: 'rgba(26,24,38,0.92)', border: '1px solid rgba(200,169,110,0.3)' }}>
              <div className="absolute top-4 right-4 px-2 py-1 rounded-full font-dm-mono text-xs" style={{ background: 'rgba(200,169,110,0.2)', color: '#C8A96E' }}>
                Le plus populaire
              </div>
              <p className="font-dm-mono text-xs mb-4" style={{ color: '#C8A96E' }}>ACCÈS COMPLET</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="font-cormorant text-5xl font-light" style={{ color: '#F8F6F0' }}>Sur mesure</span>
              </div>
              <p className="font-dm-sans text-sm mb-6" style={{ color: '#94A3B8' }}>Adapté à la taille de votre réseau. Appelez-nous.</p>
              <ul className="space-y-2.5 mb-8">
                {['DIPs illimités', 'Franchisés illimités', 'Historique complet des versions', 'Notifications Brevo/email automatiques', 'Webhooks Zapier & API', 'Intégration YouSign (e-signature)', 'Onboarding personnalisé Iralink', 'Support prioritaire'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#C8A96E' }} />
                    <span className="font-dm-sans text-sm" style={{ color: '#CBD5E1' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/waitlist" className="block text-center font-dm-sans text-sm font-medium py-3 rounded-xl transition-all" style={{ background: '#C8A96E', color: '#1A1826' }}>
                Rejoindre la liste d'attente
              </Link>
            </div>
          </FadeIn>
        </div>

        {/* Legal note */}
        <FadeIn delay={200}>
          <div className="mt-8 rounded-2xl p-6 max-w-3xl mx-auto" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(200,169,110,0.15)' }}>
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#C8A96E' }} />
              <div>
                <p className="font-dm-sans text-sm font-medium mb-1" style={{ color: '#1A1826' }}>Développé par des experts du droit de la franchise</p>
                <p className="font-dm-sans text-xs leading-relaxed" style={{ color: '#64748B' }}>
                  DIPpro est développé par Iralink en collaboration avec des juristes spécialisés en droit de la franchise.
                  Notre modèle IA est entraîné sur la réglementation Loi Doubin et la jurisprudence française.
                  Nous recommandons de faire valider le DIP final par un avocat spécialisé — notre rapport facilite et réduit ce travail.
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-6 pb-24">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="font-cormorant text-4xl mb-4" style={{ color: '#1A1826' }}>Questions fréquentes</h2>
          </div>
          <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
            {FAQS.map(({ q, a }) => (
              <FAQItem key={q} q={q} a={a} />
            ))}
          </div>
        </FadeIn>
      </section>

      {/* CTA FINAL */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <FadeIn>
          <div className="rounded-3xl p-12 text-center" style={{ background: 'rgba(26,24,38,0.92)', border: '1px solid rgba(200,169,110,0.25)' }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 font-dm-mono text-xs" style={{ background: 'rgba(200,169,110,0.15)', border: '1px solid rgba(200,169,110,0.3)', color: '#C8A96E' }}>
              <Clock className="w-3.5 h-3.5" />
              Essai gratuit 5 jours — aucune carte bancaire
            </div>
            <h2 className="font-cormorant text-4xl mb-4" style={{ color: '#F8F6F0' }}>Prêt à sécuriser votre réseau ?</h2>
            <p className="font-dm-sans text-base mb-8" style={{ color: '#94A3B8', maxWidth: 480, margin: '0 auto 2rem' }}>
              Rejoignez les franchiseurs qui font confiance à DIPpro pour leur conformité légale.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <LiquidGlassBtn
                onClick={() => navigate('/register')}
                padding="16px 32px"
                cornerRadius={14}
                displacementScale={80}
                blurAmount={0.12}
                saturation={160}
                aberrationIntensity={2}
                elasticity={0.25}
                mode="prominent"
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'DM Sans, sans-serif', fontSize: 15, fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>
                  Créer mon compte gratuitement
                  <ArrowRight style={{ width: 20, height: 20 }} />
                </span>
              </LiquidGlassBtn>

              <LiquidGlassBtn
                onClick={() => navigate('/waitlist')}
                padding="14px 24px"
                cornerRadius={14}
                displacementScale={50}
                blurAmount={0.06}
                saturation={130}
                aberrationIntensity={1}
                elasticity={0.18}
                mode="standard"
              >
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>
                  Rejoindre la liste d&apos;attente
                </span>
              </LiquidGlassBtn>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(200,169,110,0.15)', background: 'rgba(255,255,255,0.5)' }}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.3)' }}>
                  <Shield className="w-3.5 h-3.5" style={{ color: '#C8A96E' }} />
                </div>
                <span className="font-cormorant text-lg" style={{ color: '#1A1826' }}>DIPpro</span>
              </div>
              <p className="font-dm-sans text-xs leading-relaxed" style={{ color: '#94A3B8' }}>L'outil de conformité DIP pour les franchiseurs français. Développé par Iralink.</p>
            </div>
            <div>
              <p className="font-dm-mono text-xs mb-3" style={{ color: '#C8A96E' }}>PRODUIT</p>
              {[['#fonctionnalites', 'Fonctionnalités'], ['#tarifs', 'Tarifs'], ['#comment', 'Comment ça marche'], ['/register', 'Essai gratuit']].map(([href, label]) => (
                <div key={href} className="mb-2">
                  {href.startsWith('/') ? <Link to={href} className="font-dm-sans text-xs" style={{ color: '#64748B' }}>{label}</Link>
                   : <a href={href} className="font-dm-sans text-xs" style={{ color: '#64748B' }}>{label}</a>}
                </div>
              ))}
            </div>
            <div>
              <p className="font-dm-mono text-xs mb-3" style={{ color: '#C8A96E' }}>LÉGAL</p>
              {[['/cgu', 'CGU'], ['/privacy', 'Confidentialité'], ['/mentions-legales', 'Mentions légales']].map(([to, label]) => (
                <div key={to} className="mb-2">
                  <Link to={to} className="font-dm-sans text-xs" style={{ color: '#64748B' }}>{label}</Link>
                </div>
              ))}
            </div>
            <div>
              <p className="font-dm-mono text-xs mb-3" style={{ color: '#C8A96E' }}>CONTACT</p>
              <p className="font-dm-sans text-xs mb-2" style={{ color: '#64748B' }}>Iralink Agency</p>
              <a href="mailto:theo@iralink-agency.com" className="font-dm-mono text-xs" style={{ color: '#C8A96E' }}>theo@iralink-agency.com</a>
              <div className="mt-3">
                <Link to="/waitlist" className="font-dm-sans text-xs px-3 py-1.5 rounded border inline-block" style={{ border: '1px solid rgba(200,169,110,0.3)', color: '#C8A96E' }}>
                  Liste d'attente
                </Link>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderColor: 'rgba(200,169,110,0.12)' }}>
            <p className="font-dm-sans text-xs" style={{ color: '#94A3B8' }}>© {new Date().getFullYear()} DIPpro by Iralink — Tous droits réservés</p>
            <div className="flex items-center gap-3">
              {['Loi Doubin', 'RGPD', 'Hébergé en France'].map(b => (
                <div key={b} className="flex items-center gap-1.5 font-dm-sans text-xs" style={{ color: '#94A3B8' }}>
                  <CheckCircle className="w-3 h-3" style={{ color: '#22C55E' }} />
                  {b}
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
