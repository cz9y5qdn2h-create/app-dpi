import { Link, useParams } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

const LEGAL_CONTENT = {
  cgu: {
    title: "Conditions Générales d'Utilisation",
    lastUpdated: '5 mai 2026',
    sections: [
      {
        title: '1. Objet',
        content: `Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme DIPpro, éditée par Iralink Agency (ci-après "Iralink"), accessible à l'adresse dippro.business.

DIPpro est un outil SaaS d'aide à la gestion et à la conformité des Documents d'Information Précontractuelle (DIP) pour les franchiseurs, conformément à la Loi Doubin (Loi n°89-1008 du 31 décembre 1989) et à l'article L.330-3 du Code de commerce.`
      },
      {
        title: '2. Acceptation des conditions',
        content: `L'accès et l'utilisation de la plateforme impliquent l'acceptation sans réserve des présentes CGU. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser le service.

Iralink se réserve le droit de modifier les présentes CGU à tout moment. Les modifications prennent effet dès leur publication sur la plateforme. L'utilisation continue du service après modification vaut acceptation des nouvelles conditions.`
      },
      {
        title: '3. Description du service',
        content: `DIPpro propose les fonctionnalités suivantes :
- Analyse automatique de la conformité des DIP par intelligence artificielle
- Génération de DIP complets à partir d'un formulaire guidé
- Détection des changements entre versions de DIP
- Gestion des franchisés et envoi de notifications
- Export des documents en format PDF et DOCX
- Alertes de renouvellement annuel

L'analyse IA est fournie à titre indicatif et ne constitue pas un conseil juridique. L'utilisateur reste seul responsable de la conformité légale de son DIP.`
      },
      {
        title: '4. Responsabilités de l\'utilisateur',
        content: `L'utilisateur s'engage à :
- Fournir des informations exactes et à jour
- Maintenir la confidentialité de ses identifiants
- Ne pas utiliser la plateforme à des fins illégales
- Ne pas tenter de contourner les mesures de sécurité
- Vérifier les analyses IA auprès d'un professionnel du droit avant usage officiel

L'utilisateur est seul responsable du contenu de son DIP et de sa conformité légale effective.`
      },
      {
        title: '5. Limitation de responsabilité',
        content: `Iralink ne saurait être tenu responsable :
- Des erreurs ou omissions dans les analyses IA
- Des conséquences juridiques résultant de l'utilisation du DIP généré
- Des interruptions de service liées à des maintenances ou incidents techniques
- Des données perdues suite à une suppression de compte

Les analyses produites par l'IA sont des outils d'aide à la décision. Elles ne remplacent pas l'avis d'un avocat spécialisé en droit de la franchise.`
      },
      {
        title: '6. Propriété intellectuelle',
        content: `La plateforme DIPpro, son code source, son design et ses fonctionnalités sont la propriété exclusive d'Iralink Agency. Toute reproduction, modification ou exploitation sans autorisation préalable est interdite.

Le contenu généré par l'IA à partir des données de l'utilisateur appartient à l'utilisateur, sous réserve des droits d'usage accordés à Iralink pour l'amélioration du service.`
      },
      {
        title: '7. Résiliation',
        content: `L'utilisateur peut résilier son compte à tout moment depuis les paramètres ou en contactant support@iralink-agency.com.

Iralink se réserve le droit de suspendre ou résilier un compte en cas de violation des présentes CGU, sans préavis.`
      },
      {
        title: '8. Droit applicable',
        content: `Les présentes CGU sont régies par le droit français. En cas de litige, les parties s'efforceront de trouver une solution amiable. À défaut, le litige sera soumis aux tribunaux compétents de Paris.`
      }
    ]
  },
  privacy: {
    title: 'Politique de Confidentialité',
    lastUpdated: '5 mai 2026',
    sections: [
      {
        title: '1. Responsable du traitement',
        content: `Iralink Agency, dont le siège social est à Paris, est responsable du traitement de vos données personnelles au sens du Règlement Général sur la Protection des Données (RGPD — Règlement (UE) 2016/679).

Contact DPO : privacy@iralink-agency.com`
      },
      {
        title: '2. Données collectées',
        content: `Nous collectons les données suivantes :

Données de compte : nom, email, nom de société, téléphone, adresse
Données DIP : contenu des documents uploadés et générés
Données d'utilisation : logs de connexion, actions effectuées
Données de facturation : informations de paiement (traitées par Stripe)
Franchisés : nom, email, téléphone des contacts franchisés renseignés

Nous ne collectons pas de données sensibles au sens du RGPD.`
      },
      {
        title: '3. Finalités et bases légales',
        content: `Vos données sont traitées pour :
- Fourniture du service (base : exécution du contrat)
- Amélioration de l'IA (base : intérêt légitime — données anonymisées)
- Envoi d'emails transactionnels (base : exécution du contrat)
- Facturation (base : obligation légale)
- Marketing (base : consentement)`
      },
      {
        title: '4. Hébergement et sécurité',
        content: `Vos données sont hébergées sur Supabase (infrastructure AWS eu-west-1 — Europe) et Vercel (CDN international). Les communications sont chiffrées TLS. Les clés API sont stockées de manière sécurisée dans Vercel.

L'IA est alimentée par Anthropic (Claude). Les textes des DIP sont transmis à l'API Anthropic pour analyse. Anthropic ne conserve pas les données au-delà du traitement immédiat selon leur politique.`
      },
      {
        title: '5. Durée de conservation',
        content: `Données de compte : durée de l'abonnement + 1 an
Documents DIP : durée de l'abonnement
Logs : 90 jours
Données de facturation : 10 ans (obligation comptable)`
      },
      {
        title: '6. Vos droits',
        content: `Conformément au RGPD, vous disposez des droits suivants :
- Droit d'accès à vos données
- Droit de rectification
- Droit à l'effacement ("droit à l'oubli")
- Droit à la portabilité
- Droit d'opposition au traitement
- Droit à la limitation du traitement

Pour exercer vos droits : privacy@iralink-agency.com
Vous pouvez également déposer une plainte auprès de la CNIL (www.cnil.fr).`
      },
      {
        title: '7. Cookies',
        content: `DIPpro utilise des cookies techniques strictement nécessaires au fonctionnement du service (session d'authentification). Aucun cookie publicitaire ou de tracking tiers n'est utilisé.`
      }
    ]
  },
  'mentions-legales': {
    title: 'Mentions Légales',
    lastUpdated: '5 mai 2026',
    sections: [
      {
        title: 'Éditeur',
        content: `Iralink Agency
Forme juridique : [À compléter]
Capital social : [À compléter]
Adresse : [À compléter], France
Email : theo@iralink-agency.com
Directeur de publication : [Nom du dirigeant]`
      },
      {
        title: 'Hébergement',
        content: `Frontend & API : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA
Base de données : Supabase Inc., 970 Toa Payoh North, Singapour (données stockées AWS eu-west-1)`
      },
      {
        title: 'Propriété intellectuelle',
        content: `L'ensemble du contenu de DIPpro (textes, logos, design, code source) est la propriété exclusive d'Iralink Agency, protégé par les lois françaises et internationales relatives à la propriété intellectuelle.

Toute reproduction, représentation ou diffusion, en tout ou partie, est interdite sans l'autorisation préalable d'Iralink.`
      },
      {
        title: 'Limitation de responsabilité',
        content: `Les analyses produites par l'intelligence artificielle sont des outils d'aide à la décision. Elles ne constituent pas un conseil juridique et ne sauraient engager la responsabilité d'Iralink Agency.

L'utilisateur est seul responsable de la conformité légale de son Document d'Information Précontractuelle.`
      },
      {
        title: 'Droit applicable',
        content: `Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents.`
      }
    ]
  }
};

export default function LegalPage() {
  const { slug } = useParams();
  const content = LEGAL_CONTENT[slug];

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(145deg, #dde2f5 0%, #ebe7fa 40%, #dceaf8 70%)' }}>
        <div className="text-center">
          <p className="font-cormorant text-2xl mb-4" style={{ color: '#1A1826' }}>Page introuvable</p>
          <Link to="/" className="font-dm-sans text-sm" style={{ color: '#C8A96E' }}>← Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #dde2f5 0%, #ebe7fa 40%, #dceaf8 70%, #e3e1f6 100%)' }}>
      {/* Header */}
      <header style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(200,169,110,0.18)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.3)' }}>
              <Shield className="w-3.5 h-3.5" style={{ color: '#C8A96E' }} />
            </div>
            <span className="font-cormorant text-lg" style={{ color: '#1A1826' }}>DIPpro</span>
          </Link>
          <span style={{ color: '#94A3B8' }}>/</span>
          <span className="font-dm-sans text-sm" style={{ color: '#64748B' }}>{content.title}</span>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 font-dm-sans text-sm mb-8 transition-colors" style={{ color: '#94A3B8' }}>
          <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
        </Link>

        <div className="rounded-2xl p-8 lg:p-12" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <h1 className="font-cormorant text-4xl mb-2" style={{ color: '#1A1826' }}>{content.title}</h1>
          <p className="font-dm-mono text-xs mb-10" style={{ color: '#94A3B8' }}>Dernière mise à jour : {content.lastUpdated}</p>

          <div className="space-y-8">
            {content.sections.map((section) => (
              <div key={section.title}>
                <h2 className="font-dm-sans text-lg font-semibold mb-3" style={{ color: '#1A1826' }}>{section.title}</h2>
                <div className="font-dm-sans text-sm leading-relaxed whitespace-pre-line" style={{ color: '#64748B' }}>
                  {section.content}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t flex items-center justify-between" style={{ borderColor: 'rgba(200,169,110,0.15)' }}>
            <p className="font-dm-sans text-xs" style={{ color: '#94A3B8' }}>© {new Date().getFullYear()} Iralink Agency — Tous droits réservés</p>
            <div className="flex gap-4">
              <Link to="/cgu" className="font-dm-sans text-xs" style={{ color: '#94A3B8' }}>CGU</Link>
              <Link to="/privacy" className="font-dm-sans text-xs" style={{ color: '#94A3B8' }}>Confidentialité</Link>
              <Link to="/mentions-legales" className="font-dm-sans text-xs" style={{ color: '#94A3B8' }}>Mentions légales</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
