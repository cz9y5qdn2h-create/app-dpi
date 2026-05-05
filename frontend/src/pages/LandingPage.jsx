import { Link } from 'react-router-dom';
import { Shield, CheckCircle, FileText, Bell, Users, Download, Zap, ArrowRight, Star } from 'lucide-react';

const FEATURES = [
  {
    icon: FileText,
    title: 'Analyse IA en 30 secondes',
    desc: 'Importez votre DIP — Claude Opus analyse les 10 sections Loi Doubin et génère un score de conformité instantané.'
  },
  {
    icon: Shield,
    title: 'Génération depuis zéro',
    desc: 'Renseignez un formulaire guidé et l\'IA rédige un DIP complet, conforme et directement exploitable.'
  },
  {
    icon: Bell,
    title: 'Alertes de renouvellement',
    desc: 'Rappels automatiques avant l\'expiration annuelle obligatoire. Ne ratez plus jamais une échéance légale.'
  },
  {
    icon: Zap,
    title: 'Détection des changements',
    desc: 'Comparez deux versions de votre DIP. L\'IA identifie chaque modification à notifier légalement aux franchisés.'
  },
  {
    icon: Users,
    title: 'Gestion des franchisés',
    desc: 'Carnet de contacts centralisé. Envoyez des notifications par email ou WhatsApp en un clic.'
  },
  {
    icon: Download,
    title: 'Export PDF & DOCX',
    desc: 'Téléchargez votre DIP reformulé en DOCX et le rapport de conformité en PDF — prêts pour vos avocats.'
  }
];

const STEPS = [
  { num: '01', title: 'Importez votre DIP', desc: 'Glissez votre fichier PDF ou DOCX. L\'IA extrait et structure le contenu automatiquement.' },
  { num: '02', title: 'Analysez la conformité', desc: 'Score global, sections détaillées, points critiques : tout est diagnostiqué en quelques secondes.' },
  { num: '03', title: 'Corrigez et exportez', desc: 'Appliquez les recommandations, exportez le DIP reformulé et le rapport PDF.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #dde2f5 0%, #ebe7fa 40%, #dceaf8 70%, #e3e1f6 100%)' }}>

      {/* HEADER */}
      <header style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(200,169,110,0.18)' }} className="sticky top-0 z-50">
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
          <div className="flex items-center gap-3">
            <Link to="/login" className="font-dm-sans text-sm px-4 py-2 rounded-lg transition-colors" style={{ color: '#64748B' }}
              onMouseEnter={e => e.target.style.color = '#1A1826'}
              onMouseLeave={e => e.target.style.color = '#64748B'}>
              Connexion
            </Link>
            <Link to="/register" className="font-dm-sans text-sm px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all" style={{ background: '#C8A96E', color: '#1A1826' }}>
              Essayer gratuitement
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 font-dm-mono text-xs" style={{ background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.25)', color: '#C8A96E' }}>
          <Star className="w-3.5 h-3.5" />
          Conforme Loi Doubin — Art. L.330-3 du Code de commerce
        </div>

        <h1 className="font-cormorant text-6xl lg:text-7xl font-light mb-6" style={{ color: '#1A1826', lineHeight: 1.08 }}>
          Votre DIP,<br />
          <span style={{ color: '#C8A96E' }}>conforme et sans effort.</span>
        </h1>

        <p className="font-dm-sans text-lg max-w-2xl mx-auto mb-10" style={{ color: '#64748B', lineHeight: 1.7 }}>
          DIPpro analyse, génère et met à jour votre Document d'Information Précontractuelle grâce à l'IA. Zéro risque juridique, zéro prise de tête.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/register" className="font-dm-sans font-medium px-8 py-4 rounded-xl flex items-center gap-3 text-base transition-all hover:shadow-lg" style={{ background: '#C8A96E', color: '#1A1826' }}>
            Commencer maintenant — c'est gratuit
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link to="/login" className="font-dm-sans text-sm px-6 py-4 rounded-xl border transition-all" style={{ border: '1px solid rgba(200,169,110,0.3)', color: '#64748B', background: 'rgba(255,255,255,0.5)' }}>
            J'ai déjà un compte
          </Link>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-14">
          {['Loi Doubin 1989', 'Art. L.330-3', 'RGPD conforme', 'Données hébergées en France'].map(b => (
            <div key={b} className="flex items-center gap-2 font-dm-sans text-sm" style={{ color: '#64748B' }}>
              <CheckCircle className="w-4 h-4" style={{ color: '#22C55E' }} />
              {b}
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-16">
          <h2 className="font-cormorant text-4xl mb-4" style={{ color: '#1A1826' }}>Tout ce dont vous avez besoin</h2>
          <p className="font-dm-sans text-base" style={{ color: '#64748B' }}>En tant que franchiseur, la conformité DIP est votre responsabilité légale. DIPpro la rend simple.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl p-6 transition-all hover:shadow-lg" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.2)' }}>
                <Icon className="w-5 h-5" style={{ color: '#C8A96E' }} />
              </div>
              <h3 className="font-dm-sans text-base font-semibold mb-2" style={{ color: '#1A1826' }}>{title}</h3>
              <p className="font-dm-sans text-sm leading-relaxed" style={{ color: '#64748B' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-16">
          <h2 className="font-cormorant text-4xl mb-4" style={{ color: '#1A1826' }}>Comment ça fonctionne</h2>
          <p className="font-dm-sans text-base" style={{ color: '#64748B' }}>Opérationnel en 3 minutes chrono.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map(({ num, title, desc }) => (
            <div key={num} className="text-center">
              <div className="font-cormorant text-6xl font-light mb-4" style={{ color: 'rgba(200,169,110,0.3)' }}>{num}</div>
              <h3 className="font-dm-sans text-lg font-semibold mb-3" style={{ color: '#1A1826' }}>{title}</h3>
              <p className="font-dm-sans text-sm leading-relaxed" style={{ color: '#64748B' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="rounded-3xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(24px)', border: '1px solid rgba(200,169,110,0.2)' }}>
          <h2 className="font-cormorant text-4xl mb-4" style={{ color: '#1A1826' }}>Prêt à sécuriser votre réseau ?</h2>
          <p className="font-dm-sans text-base mb-8" style={{ color: '#64748B', maxWidth: 480, margin: '0 auto 2rem' }}>
            Rejoignez les franchiseurs qui font confiance à DIPpro pour leur conformité légale.
          </p>
          <Link to="/register" className="inline-flex items-center gap-3 font-dm-sans font-medium px-8 py-4 rounded-xl text-base transition-all hover:shadow-lg" style={{ background: '#C8A96E', color: '#1A1826' }}>
            Créer mon compte gratuitement
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(200,169,110,0.15)', background: 'rgba(255,255,255,0.5)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-dm-sans text-sm" style={{ color: '#94A3B8' }}>
            © {new Date().getFullYear()} DIPpro by Iralink — Tous droits réservés
          </p>
          <div className="flex items-center gap-6">
            <Link to="/mentions-legales" className="font-dm-sans text-sm transition-colors" style={{ color: '#94A3B8' }}>Mentions légales</Link>
            <Link to="/cgu" className="font-dm-sans text-sm transition-colors" style={{ color: '#94A3B8' }}>CGU</Link>
            <Link to="/privacy" className="font-dm-sans text-sm transition-colors" style={{ color: '#94A3B8' }}>Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
