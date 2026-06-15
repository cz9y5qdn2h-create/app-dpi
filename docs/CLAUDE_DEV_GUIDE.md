# DIPpro — Guide Développeur Complet

> Iralink Agency · Développeur principal : Théo  
> Dernière mise à jour : 15 juin 2026

---

## 1. Vue d'ensemble du projet

**DIPpro** est un SaaS B2B pour la gestion et la conformité des Documents d'Information Précontractuelle (DIP) imposés par la **Loi Doubin** (art. L.330-3 Code de commerce) aux franchiseurs français.

### Proposition de valeur
- Upload PDF/DOCX → analyse IA → score de conformité
- Génération de DIP guidée par formulaire
- Détection automatique des changements entre versions
- Notifications franchisés + analytics de lecture

---

## 2. Stack technique

### Frontend
| Technologie | Version | Rôle |
|---|---|---|
| React | 18 | UI framework |
| Vite | 5 | Build tool + dev server |
| TailwindCSS | 3 | Styles (CSS vars + utility classes) |
| React Router | v6 | SPA routing, routes protégées |
| @tanstack/react-query | 5 | Cache serveur, refetch auto |
| Supabase JS | 2 | Auth côté client uniquement |
| i18next + react-i18next | — | Internationalisation FR/EN |
| Framer Motion | — | Animations |
| Lucide React | — | Icônes |
| react-hot-toast | — | Notifications toast |
| Axios | — | HTTP client vers `/api/*` |

### Backend
| Technologie | Version | Rôle |
|---|---|---|
| Express.js | 4 | API REST `/api/*` |
| @supabase/supabase-js | 2 | BDD + Auth (service role) |
| @anthropic-ai/sdk | — | Claude claude-opus-4-7 |
| pdf-parse | — | Extraction texte PDF |
| mammoth | — | Extraction texte DOCX |
| helmet | — | Headers sécurité HTTP |
| express-rate-limit | — | Protection rate limiting |

### Infra
| Service | Rôle |
|---|---|
| Vercel | Frontend build + API serverless (timeout 60s) |
| Supabase | PostgreSQL + Auth + Storage |
| Brevo (Sendinblue) | Emails transactionnels |
| Anthropic | API Claude IA |

---

## 3. Architecture des répertoires

```
app-dpi/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Routes React + ErrorBoundary
│   │   ├── main.jsx                  # Providers + i18n init
│   │   ├── i18n/
│   │   │   ├── index.js              # Config i18next
│   │   │   └── locales/
│   │   │       ├── fr.json           # Traductions françaises (~540 clés)
│   │   │       └── en.json           # Traductions anglaises (~540 clés)
│   │   ├── context/
│   │   │   ├── AuthContext.jsx       # Supabase auth + profil utilisateur
│   │   │   └── ThemeContext.jsx      # 5 thèmes, localStorage
│   │   ├── lib/
│   │   │   ├── supabase.js           # UNIQUE singleton Supabase client
│   │   │   └── api.js                # Axios instance + interceptors 401/403
│   │   ├── components/
│   │   │   ├── Layout.jsx            # Shell avec Sidebar
│   │   │   └── Sidebar.jsx           # Nav + theme switcher + lang switcher + logout
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── RegisterPage.jsx
│   │       ├── DashboardPage.jsx
│   │       ├── DIPPage.jsx           # Vue + génération DIP
│   │       ├── UploadDIPPage.jsx     # Upload + analyse IA
│   │       ├── AlertsPage.jsx
│   │       ├── HistoryPage.jsx
│   │       ├── FranchiseesPage.jsx
│   │       ├── SettingsPage.jsx
│   │       ├── ExportPage.jsx
│   │       ├── AdminPage.jsx
│   │       ├── AnalyticsPage.jsx     # Analytics de lecture DIP
│   │       ├── SharedDIPPage.jsx     # Page publique (lien tokenisé)
│   │       └── LegalPage.jsx         # CGU / Politique confidentialité / ML / Cookies
│   ├── vite.config.js
│   └── package.json
│
├── backend/
│   └── src/
│       ├── server.js                 # Express app + montage routes
│       ├── config/
│       │   ├── supabase.js           # UNIQUE singleton supabaseAdmin (service role)
│       │   └── claude.js             # Fonctions IA Claude
│       └── routes/
│           ├── auth.js               # POST /login, /register, /refresh
│           ├── dip.js                # CRUD DIP + upload + partage
│           ├── alerts.js             # Alertes + corrections IA
│           ├── franchisees.js        # CRUD franchisés + notifications
│           ├── settings.js           # Paramètres utilisateur
│           ├── export.js             # Export DOCX/PDF/JSON
│           ├── admin.js              # Console admin
│           ├── history.js            # Journal d'audit
│           ├── notifications.js      # Envoi emails Brevo
│           ├── analytics.js          # POST lecture / GET stats
│           └── waitlist.js           # Liste d'attente landing
│
├── supabase/
│   └── migrations/                   # Migrations SQL (historique)
│
├── docs/                             # ← Ce dossier
│   ├── CLAUDE_DEV_GUIDE.md           # Ce fichier
│   └── LIVRET_ERREURS.md             # Référence des erreurs connues
│
├── api/
│   └── index.js                      # Point d'entrée Vercel serverless
├── vercel.json                        # Config Vercel (routes + build)
└── CLAUDE.md                          # Instructions pour l'agent IA
```

---

## 4. Variables d'environnement

### Frontend (injectées au build Vite — VITE_*)
```env
VITE_SUPABASE_URL=https://xlfycuhmbnzeofgnleof.supabase.co
VITE_SUPABASE_ANON_KEY=<clé publique Supabase>
VITE_API_URL=https://votre-domaine.vercel.app
```
⚠️ Ces variables sont **baked au build**. Si undefined en production → erreurs silencieuses de fetch. Vérifier dans Vercel → Settings → Environment Variables.

### Backend (variables d'environnement Vercel/serveur)
```env
PORT=3001
FRONTEND_URL=https://votre-domaine.vercel.app
SUPABASE_URL=https://xlfycuhmbnzeofgnleof.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<clé service role — JAMAIS dans le code>
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-7
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=noreply@dip-pilot.fr
BREVO_SENDER_NAME=DIP Pilot
ADMIN_EMAIL=theo@iralink-agency.com
ADMIN_PASSWORD=<mot de passe admin>
```
⚠️ `SUPABASE_SERVICE_ROLE_KEY` est une clé **admin** qui contourne le RLS. Ne jamais l'exposer côté client ni la committer.

---

## 5. Design System — Liquid Glass

### 5 thèmes disponibles
| ID | Nom | Style |
|---|---|---|
| `glass` | Iralink (défaut) | Clair, tons dorés |
| `nuit` | Nuit | Sombre doré |
| `azur` | Azur | Marine glacé |
| `nacre` | Nacre | Blanc épuré |
| `emeraude` | Émeraude | Forêt sombre |

Le thème s'applique via `data-theme="<id>"` sur `document.documentElement` (persisté dans `localStorage('dippro-theme')`).

### Règle absolue : jamais de couleurs hardcodées
Utiliser exclusivement :
- Classes Tailwind avec CSS vars : `text-gold`, `bg-bg-primary`, etc.
- Ou les CSS custom properties directement en `style={{}}`

### Classes CSS globales utiles
```
.card              — carte principale
.btn-primary       — bouton principal doré
.btn-ghost         — bouton secondaire
.nav-link          — lien de navigation
.nav-link-active   — lien de navigation actif
.sidebar-panel     — panneau sidebar
.input-field       — champ de formulaire
.btn-liquid-glass-prominent — CTA principal
```

---

## 6. Internationalisation (i18n)

**Librairie** : `i18next` + `react-i18next`  
**Langue par défaut** : `fr` (détectée depuis `localStorage('dippro-lang')`)  
**Toggle** : bouton FR/EN dans la Sidebar

### Ajouter une traduction
1. Ajouter la clé dans `frontend/src/i18n/locales/fr.json`
2. Ajouter la traduction dans `frontend/src/i18n/locales/en.json`
3. Dans le composant : `const { t } = useTranslation();` → `{t('ma.cle')}`

### Variables dans les traductions
```js
// fr.json : "greeting": "Bonjour, {{name}}"
t('dashboard.greeting', { name: 'Théo' })
// → "Bonjour, Théo"
```

---

## 7. Authentification

### Flux
1. `POST /api/auth/login` → backend vérifie avec Supabase Auth (service role) → retourne `access_token`
2. Token stocké dans `localStorage('access_token')`
3. `api.js` interceptor : ajoute `Authorization: Bearer <token>` à chaque requête
4. Routes backend : `requireAuth` middleware vérifie le JWT via Supabase

### Règle GoTrueClient (CRITIQUE)
**Un seul `createClient()` dans tout le frontend.** Le fichier `lib/supabase.js` est le **singleton unique**. Si d'autres fichiers ont besoin du client, ils importent :
```js
import { supabase } from '../lib/supabase';
```
⚠️ Ne jamais appeler `createClient()` dans un composant ou une autre librairie — cela crée une deuxième instance GoTrueClient et produit des conflits de session.

---

## 8. API Backend — Routes

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Connexion |
| POST | `/api/auth/register` | Public | Inscription |
| GET | `/api/dip` | Auth | Récupérer DIP actif |
| POST | `/api/dip/upload` | Auth | Upload + analyse IA |
| GET | `/api/dip/share/:token` | Public | DIP partagé (tokenisé) |
| GET | `/api/alerts` | Auth | Liste des alertes |
| PATCH | `/api/alerts/:id` | Auth | Valider/ignorer alerte |
| GET | `/api/franchisees` | Auth | Liste franchisés |
| POST | `/api/franchisees` | Auth | Ajouter franchisé |
| POST | `/api/notifications/send` | Auth | Envoyer notification |
| GET | `/api/analytics/dip/:id` | Auth | Stats de lecture |
| POST | `/api/analytics/read` | Public (rate-limited) | Tracker section lue |
| GET | `/api/waitlist/count` | Public | Compteur liste d'attente |
| GET | `/api/admin/stats` | Admin | Stats globales |

---

## 9. Base de données Supabase

**Projet** : `xlfycuhmbnzeofgnleof`  
**Région** : AWS eu-west-1 (Irlande)

### Tables principales
| Table | Description |
|---|---|
| `users` | Profils franchiseurs |
| `dip_documents` | Documents DIP (versions) |
| `dip_sections` | Sections analysées des DIP |
| `alerts` | Alertes et corrections IA |
| `franchisees` | Annuaire franchisés |
| `notification_logs` | Historique emails envoyés |
| `history_events` | Journal d'audit |
| `data_sources` | Sources de veille |
| `dip_reads` | Analytics de lecture (anonymes) |
| `waitlist` | Liste d'attente landing |

### RLS (Row Level Security)
Toutes les tables ont RLS activé. Le backend utilise `supabaseAdmin` (service role) qui **contourne** le RLS — c'est intentionnel pour les opérations serveur.

**Pattern de performance RLS** : toujours utiliser `(select auth.uid())` au lieu de `auth.uid()` directement dans les politiques multi-lignes → évite la ré-évaluation à chaque ligne.

### Storage
- **Bucket** : `dip-files` (privé) et `dip-certificates` (privé)
- Accès via le backend uniquement (URLs signées)

---

## 10. IA — Configuration Claude

**Modèle** : `claude-opus-4-7` (configuré via `ANTHROPIC_MODEL`)  
**Prompt caching** : activé sur `SYSTEM_DIP_EXPERT` → ~90% réduction de coût

### Fonctions dans `backend/src/config/claude.js`
| Fonction | Description |
|---|---|
| `parseDIPSections(rawText)` | Extrait les 10 sections réglementaires Loi Doubin |
| `compareDIPVersions(prev, new)` | Détecte les changements à impact légal |
| `detectChanges(section, newDoc, title)` | Compare section vs nouveau document |
| `generateUpdateSummary(sections)` | Génère message notification franchisés |

---

## 11. Déploiement Vercel

### Config `vercel.json`
```json
{
  "installCommand": "npm install && cd frontend && npm install",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist"
}
```

### API serverless
Fichier d'entrée : `api/index.js` → timeout 60s max.  
⚠️ Les analyses Claude peuvent prendre 30-60s — rester sous le timeout.

### Workflow de déploiement
1. Push sur `main` → Vercel redéploie automatiquement
2. Vérifier les logs de build dans le dashboard Vercel si échec
3. Vérifier les variables d'env si les API calls échouent en prod

---

## 12. Git workflow

```bash
# Branche de développement
git checkout claude/build-dippro-mvp-SZEtW

# Push vers les deux branches
git push origin main:claude/build-dippro-mvp-SZEtW && git push origin main

# Format des commits
feat(scope): description
fix(scope): description
refactor(scope): description
docs(scope): description
```

---

## 13. Checklist avant déploiement

- [ ] `cd frontend && npm run build` passe sans erreur
- [ ] Variables d'env définies dans Vercel (SUPABASE_, ANTHROPIC_, BREVO_)
- [ ] Aucun `console.log` en production
- [ ] Aucune couleur hardcodée (utiliser CSS vars)
- [ ] Textes traduits dans `fr.json` ET `en.json`
- [ ] Migrations Supabase appliquées si changement de schéma

---

*Généré par Claude Code · Iralink Agency*
