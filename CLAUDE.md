# DIPpro — Documentation Agent

## Projet
Application SaaS de gestion des Documents d'Information Précontractuelle (DIP) pour franchiseurs.
Développée par **Iralink** (theo@iralink-agency.com). URL de production : `https://dippro.business`.

## Stack technique

### Frontend (`/frontend`)
- **React 18** + **Vite** + **TailwindCSS** (config CSS vars)
- **React Router v6** (SPA, routes protégées + guards Trial/Auth)
- **@tanstack/react-query** — cache serveur, refetch automatique
- **Supabase JS** — auth côté client
- **axios** (`frontend/src/lib/api.js`) — client HTTP avec intercepteurs JWT auto + redirect /login sur 401
- **Lucide React** — icônes
- **Framer Motion** — animations
- **react-hot-toast** — notifications

### Backend (`/backend`)
- **Express.js** — API REST sur `/api/*`
- **Supabase** — BDD PostgreSQL + Auth (service role) + Storage (bucket `vault`)
- **@anthropic-ai/sdk** — analyse IA des DIP (multi-modèles)
- **docx** — génération de fichiers DOCX téléchargeables
- **pdf-parse + mammoth** — extraction texte PDF/DOCX
- **Helmet + express-rate-limit** — sécurité
- **crypto (Node built-in)** — chiffrement AES-256-GCM des tokens OAuth

### Infra
- **Vercel** — hébergement monorepo (frontend build + backend serverless)
- **Supabase** — projet `xlfycuhmbnzeofgnleof`
- **Vercel Cron** — `/api/monitor/run` toutes les 6h (détection changements documents)

## Structure des fichiers clés

```
frontend/src/
  App.jsx                    — routes React (voir section Routes)
  main.jsx                   — providers (Query, Theme, Auth, Toaster)
  lib/
    api.js                   — axios configuré, intercepteurs JWT + logout auto sur 401
    supabase.js              — client Supabase côté client
  context/
    AuthContext.jsx          — Supabase auth + profil + isTrialExpired
    ThemeContext.jsx         — 5 thèmes, localStorage
  components/
    Layout.jsx               — shell avec Sidebar (Outlet)
    Sidebar.jsx              — nav + theme switcher + logout
    ErrorBoundary.jsx        — fallback d'erreur React
    CalModal.jsx             — modal calendrier réutilisable
    dashboard/               — composants spécifiques au dashboard
    ui/                      — composants UI génériques (LoadingSpinner, etc.)
  pages/
    LandingPage.jsx          — page d'accueil publique (marketing)
    LegalPage.jsx            — CGU / Politique de confidentialité / Mentions légales / Cookies
    LoginPage / RegisterPage — auth publique
    WaitlistPage.jsx         — formulaire liste d'attente (public)
    SharedDIPPage.jsx        — portail franchisé partagé via token (public)
    TrialExpiredPage.jsx     — page bloquante fin d'essai
    DashboardPage            — tableau de bord
    DIPPage                  — visualisation DIP analysé
    UploadDIPPage            — upload + analyse IA
    GenerateDIPPage          — génération DIP depuis formulaire SmartField
    AlertsPage               — alertes de changements
    HistoryPage              — historique des versions
    FranchiseesPage          — gestion franchisés
    MonitorPage              — surveillance documents (Google Drive / OneDrive / local / Vault)
    SettingsPage / ExportPage / AdminPage / ApiConfigPage

backend/src/
  server.js                  — Express app (monte toutes les routes)
  config/
    dipAgent.js              — moteur IA principal (voir section IA)
    claude.js                — fonctions IA secondaires (comparaison, analyse impact)
    supabase.js              — client Supabase service role
    encryption.js            — AES-256-GCM pour chiffrer les tokens OAuth tiers
    errorMessage.js          — normalisation des messages d'erreur IA → user-friendly
  middleware/
    auth.js                  — authMiddleware (JWT Supabase) + requireFranchisor (role check)
  routes/
    agent.js                 — /api/agent/* (analyze, generate, compare, verify, docx)
    monitor.js               — /api/monitor/* (Google Drive, OneDrive, local, vault, cron)
    dip.js                   — /api/dip/* (CRUD DIP, sections, partage)
    alerts.js                — /api/alerts/*
    auth.js                  — /api/auth/* (profil, trial)
    franchisees.js           — /api/franchisees/*
    history.js               — /api/history/*
    notifications.js         — /api/notifications/*
    settings.js              — /api/settings/*
    export.js                — /api/export/*
    admin.js                 — /api/admin/*
    waitlist.js              — /api/waitlist/* (inscription publique + gestion admin)

api/index.js                 — point d'entrée Vercel Serverless → proxy vers backend/src/server.js

supabase/migrations/         — migrations SQL (voir section BDD)
```

## Routes React

```
/                    → LandingPage (si non connecté) ou redirect /dashboard
/login               → LoginPage (redirige /dashboard si déjà connecté)
/register            → RegisterPage (redirige /dashboard si déjà connecté)
/waitlist            → WaitlistPage (public)
/cgu /privacy /mentions-legales /cookies → LegalPage (public)
/dip/partage/:token  → SharedDIPPage (portail franchisé public, sans auth)
/trial-expired       → TrialExpiredPage (connecté, essai expiré)

Routes protégées (TrialGuard + Layout) :
/dashboard           → DashboardPage
/dip                 → DIPPage
/dip/upload          → UploadDIPPage
/dip/generate        → GenerateDIPPage
/alerts              → AlertsPage
/history             → HistoryPage
/franchisees         → FranchiseesPage
/settings            → SettingsPage
/export              → ExportPage
/admin               → AdminPage
/monitor             → MonitorPage
/integrations        → ApiConfigPage
```

## Guards d'accès

- `ProtectedRoute` — redirige `/` si non connecté
- `PublicOnlyRoute` — redirige `/dashboard` si déjà connecté
- `TrialGuard` — redirige `/trial-expired` si `isTrialExpired` dans AuthContext

## Middleware backend

`authMiddleware` — vérifie le Bearer JWT via `supabaseAdmin.auth.getUser()`. Expose `req.user` et `req.token`.

`requireFranchisor` — vérifie que `users.role` est `franchiseur` ou `admin`. Crée automatiquement le profil si absent (auto-provision).

## IA — dipAgent.js (moteur principal)

**3 modèles selon la criticité** :
- `claude-opus-4-7` — analyse juridique critique (`analyzeDIP`)
- `claude-sonnet-4-6` — génération + comparaison structurée (`generateDIPFromForm`, `compareDIPVersions`)
- `claude-haiku-4-5` — vérifications simples (`verifyLegalData`)

**Prompt caching** activé sur `CACHED_SYSTEM` via `cache_control: { type: "ephemeral" }`.

**Extended thinking** activé sur Opus et Sonnet via `thinking: { type: 'adaptive' }`.

**5 fonctions exportées** :
- `analyzeDIP(rawText)` — extrait et évalue les 10 sections Loi Doubin, retourne JSON avec `sections`, `global_score`, `summary`, `critical_issues`
- `generateDIPFromForm(formData, sourceText?)` — génère un DIP complet depuis formulaire + doc source optionnel
- `compareDIPVersions(previousText, newText)` — détecte les changements à impact légal (High/Moderate/Low)
- `verifyLegalData(companyInfo)` — vérifie les informations légales et retourne les sources officielles
- `generateDocx(sections, companyName)` — génère un fichier `.docx` téléchargeable via la lib `docx`

**Route `/api/agent`** — les 5 opérations exposées en POST avec extraction auto PDF/DOCX côté backend.

## Module Monitor (surveillance documents)

4 sources supportées :
- **Google Drive** — OAuth 2.0 via `GOOGLE_CLIENT_ID/SECRET`, refresh token automatique, détection par `md5Checksum`
- **OneDrive** — OAuth 2.0 via `MICROSOFT_CLIENT_ID/SECRET`, détection par `lastModifiedDateTime_size`
- **Dossier local** (Mac/Windows) — scan côté client via File System Access API, envoi hash vers `/api/monitor/local/check`
- **DIPpro Vault** — Supabase Storage (bucket `vault`), zéro config, accès sécurisé par `user_id/` prefix

Quand un document change, le monitor :
1. Extrait le texte (PDF/DOCX)
2. Appelle `analyzeDocumentForDIPImpact()` depuis `claude.js` si `auto_analyze = true`
3. Crée une entrée dans `monitored_files` + une alerte dans `alerts`

**Cron Vercel** : `/api/monitor/run` s'exécute toutes les 6h (`"schedule": "0 */6 * * *"`). Sécurisé par `MONITOR_CRON_SECRET`.

**Chiffrement des tokens OAuth** : AES-256-GCM via `encryption.js`. Clé depuis `MONITOR_ENCRYPTION_KEY` (64 hex chars) ou fallback dérivé de `SUPABASE_URL`.

## Système Waitlist

- `POST /api/waitlist` — public, sans auth. Inscrit email + société + message.
- `GET /api/waitlist` — admin uniquement. Liste avec filtrage par statut.
- `PATCH /api/waitlist/:id` — admin : change statut (`pending` / `contacted` / `converted` / `dismissed`) + notes.

## Design system — Liquid Glass

5 thèmes sélectionnables par le franchiseur, persistés dans `localStorage('dippro-theme')` :
- `glass` — Iralink par défaut, clair
- `nuit` — sombre doré
- `azur` — marine glacé
- `nacre` — blanc épuré
- `emeraude` — forêt sombre

Le thème s'applique via `data-theme="<id>"` sur `document.documentElement`.
**Ne jamais hardcoder de couleurs** dans les composants — utiliser uniquement les CSS custom properties.

Classes CSS utiles : `.card`, `.btn-primary`, `.btn-ghost`, `.nav-link`, `.nav-link-active`, `.sidebar-panel`, `.input-field`, `.btn-liquid-glass-prominent`

## Variables d'environnement

### Frontend (Vite — baked au build)
```
VITE_SUPABASE_URL=https://xlfycuhmbnzeofgnleof.supabase.co
VITE_SUPABASE_ANON_KEY=<clé publique>
VITE_API_URL=<URL de l'API backend, optionnel>
```
Fallbacks hardcodés dans `frontend/src/lib/api.js` et `AuthContext.jsx`.

### Backend
```
ANTHROPIC_API_KEY=<clé API Anthropic>
SUPABASE_URL=https://xlfycuhmbnzeofgnleof.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<clé service role>
JWT_SECRET=<secret JWT>
MONITOR_CRON_SECRET=<secret pour sécuriser /api/monitor/run>
MONITOR_ENCRYPTION_KEY=<64 chars hex — chiffrement AES-256-GCM tokens OAuth>
GOOGLE_CLIENT_ID=<OAuth Google Drive>
GOOGLE_CLIENT_SECRET=<OAuth Google Drive>
MICROSOFT_CLIENT_ID=<OAuth OneDrive>
MICROSOFT_CLIENT_SECRET=<OAuth OneDrive>
BACKEND_URL=https://dippro.business
FRONTEND_URL=https://dippro.business
```

## Base de données (Supabase)

Tables principales (migrations dans `supabase/migrations/`) :
- `users` — profils franchiseurs (role: `franchiseur` | `admin`)
- `dip_documents` — DIP actifs par utilisateur (status: `actif`)
- `dip_sections` — 10 sections réglementaires par DIP
- `dip_versions` — historique des versions de DIP
- `franchisees` — candidats franchisés liés à un franchiseur
- `alerts` — alertes de changements (type: `document_change`)
- `document_monitors` — config de surveillance par source (google_drive / onedrive / local_folder / vault)
- `monitored_files` — fichiers trackés avec hash + change_summary
- `waitlist` — inscriptions liste d'attente
- `settings` — paramètres franchiseur (notifications, automatisations)

RLS activé sur toutes les tables. La colonne `user_id` isole les données par franchiseur.

## Git workflow

- Branche de dev actuelle : `claude/claude-md-docs-ObEro`
- Branche principale : `main`
- Messages de commit en anglais, format : `type(scope): description`

## Règles de code

1. **Pas de commentaires inutiles** — le code doit se lire seul
2. **Pas de hardcode couleurs** — utiliser les classes Tailwind avec CSS vars
3. **Pas de `console.log`** en production (sauf `console.error` pour les erreurs serveur)
4. **Réponses de l'agent en français** toujours
5. **Vérifier le build** après chaque modif frontend (`cd frontend && npm run build`)
6. **Pas de features non demandées** — rester scope exact de la tâche
7. **Validation input** au niveau des routes Express (longueur, format, whitelist)
8. **Sanitizer les noms de fichier** avant toute opération FS (voir `sanitizeFilename` dans `agent.js`)

## Déploiement Vercel

```json
{
  "installCommand": "npm install && cd frontend && npm install",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "functions": { "api/index.js": { "maxDuration": 60 } },
  "crons": [{ "path": "/api/monitor/run", "schedule": "0 */6 * * *" }]
}
```

Après chaque push sur `main` → Vercel redéploie automatiquement.
Si build échoue → vérifier les vars d'env Vercel et les logs de build.
