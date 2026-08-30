# CHANGELOG — DIPpro

Journal des modifications, du plus récent au plus ancien. Chaque entrée relie
le **symptôme observé** à la **cause racine** et au **garde-fou** posé, pour
qu'une session future puisse refaire le lien sans relire tout le code.

Conventions : 🔴 correctif bloquant · 🟡 correctif · 🟢 fonctionnalité · 🔵 documentation
Voir aussi : [INVARIANTS.md](INVARIANTS.md) · [BUG_JOURNAL.md](BUG_JOURNAL.md) · [LEGAL_COPY.md](LEGAL_COPY.md)

---

## 2026-08-25 (2)

### 🔵 Annulation du pivot gratuit/open source — retour au modèle payant
Décision revenue sur elle-même dans la foulée : DIPpro reste payant
(1 300 € mise en place + 850 €/mois par cabinet). Pricing restauré à
l'identique dans `LandingPage.jsx`, `llms.txt`, `index.html` (JSON-LD +
FAQ statique) et `WaitlistPage.jsx` — build vérifié byte-identique à
l'état d'avant le pivot. Le dépôt reste privé, aucune conséquence sur ce
front. Les correctifs de sécurité faits en vue de l'open source (mot de
passe admin en dur retiré de `seed_admin.js`/docs, clé anon d'un projet
tiers retirée des `.env.example`, fallback `JWT_SECRET` retiré de
`monitor.js`) sont conservés — de bonnes pratiques indépendantes du
modèle économique, pas de raison de les annuler.

## 2026-08-25

### 🔴 Secrets en clair trouvés avant mise en open source — dépôt PAS ENCORE public
Décision annoncée : DIPpro devient gratuit et open source (dépôt GitHub
rendu public). Avant toute publication, audit complet du tree actuel ET de
l'historique git (agent dédié) — **verdict : le dépôt ne peut pas être rendu
public tel quel**, deux secrets réels actifs trouvés :
1. Mot de passe admin de production (`theo@iralink-agency.com`) en clair
   dans `backend/src/scripts/seed_admin.js` (valeur par défaut utilisée si
   `ADMIN_PASSWORD` absent), `backend/.env.example`, `supabase/seed_admin.sql`,
   `DEPLOYMENT.md`, `SETUP.md` (5 fichiers).
2. Secret webhook Supabase Vault en clair dans
   `supabase/migrations/051_notify_lead_email_secret_hardening.sql:34`
   (déjà signalé et "corrigé" le 21/08 — déplacé en Vault, mais la valeur
   reste visible dans la migration elle-même qui l'y insère).

Corrigé dans le code : plus aucune valeur par défaut pour `ADMIN_PASSWORD`
(`seed_admin.js` refuse de s'exécuter sans elle) ; tous les fichiers cités
remplacés par des placeholders génériques ; clé anon Supabase d'un projet
tiers (`nqboedyhlmyxyefjkshg`) retirée de `frontend/.env.example`,
`backend/.env.example` et `DEPLOYMENT.md` ; retrait du fallback
`'fallback'` sur `JWT_SECRET` dans `monitor.js` (signature OAuth state),
remplacé par un vrai refus 503 si absent.

**Reste à faire avant publication, hors de portée du code seul** :
1. Faire tourner le mot de passe admin réel dans Supabase Auth.
2. Régénérer le secret `notify_lead_email_webhook_secret` (Vault + Edge
   Function `send-lead-email`).
3. Purger l'historique git des deux valeurs ci-dessus (`git filter-repo`),
   puis force-push — **action destructive non effectuée, en attente de
   confirmation explicite** (réécrit tous les SHA de commit sur `main` et
   la branche de dev).
4. Seulement après ces 3 étapes : rendre le dépôt GitHub public.

### 🟢 Passage au gratuit / open source — mise à jour du pricing partout
`LandingPage.jsx` (section pricing + JSON-LD FAQ), `llms.txt`, `index.html`
(JSON-LD `Offer` + FAQ statique), `WaitlistPage.jsx` (bénéfice "Early
Adopter", SEO title/description) : les mentions de tarif (1 300 € + 850
€/mois, -40 % Early Adopter, ROI an 1) remplacées par le nouveau
positionnement gratuit + code source ouvert. Annonce LinkedIn préparée en
parallèle, publication différée jusqu'à ce que le dépôt soit effectivement
et sûrement rendu public (pas de sens à annoncer "open source" avant que
ce soit vrai et sécurisé).

## 2026-08-23 (3)

### 🔴 Soft-404 encore présent malgré middleware.mjs — vraie cause : le cache CDN, pas le middleware
Le brief du 24/08 signalait le soft-404 encore actif sur DIPpro malgré le
correctif `middleware.mjs` livré précédemment. Vérifié en direct : une URL
jamais requêtée auparavant (`/test-fresh-<random>`) répond `HTTP/2 200`,
`x-vercel-cache: HIT`, avec le même ETag et un `Age` de ~24h — c'est
exactement l'`index.html` mis en cache, servi tel quel pour n'importe quel
chemin inconnu, sans jamais atteindre `middleware.mjs`. Cause : les règles
`Cache-Control` de `vercel.json` ne ciblaient que les chemins `/index.html`
et `/` littéralement — pas les innombrables chemins que le rewrite SPA
catch-all (`"/(.*)" → "/index.html"`) réécrit vers cette même ressource.
Ces chemins héritaient donc du cache par défaut de Vercel (long, jamais
revalidé), et le CDN répondait depuis ce cache avant même d'invoquer le
middleware — le middleware n'était donc jamais le problème, il n'était
simplement jamais exécuté. Corrigé en ajoutant une règle catch-all
`"/(.*)"` avec `max-age=0, must-revalidate` en tête de `headers` dans
`vercel.json` — la règle `/assets/(.*)` (immutable) reste plus spécifique
et prioritaire pour les fichiers hashés. Accès direct à l'API Vercel non
disponible dans cette session (permission MCP non accordable en tâche de
fond) — à revérifier après le prochain déploiement avec une URL aléatoire
jamais requêtée, puisque le cache déjà posé pour les anciens chemins peut
mettre un moment à expirer même après ce correctif.

## 2026-08-23 (2)

### 🟢 Relance email — formulaire waitlist abandonné à l'email seul
Sur la landing page et /waitlist, l'email est maintenant capturé dès qu'il
quitte le champ (blur), même si le visiteur n'a jamais soumis le formulaire
en entier — un email de relance ("votre check de conformité DIP est
presque prêt") est envoyé via Resend, une seule fois par adresse, jamais
renvoyé. Table dédiée `waitlist_partial_emails` (migration 053,
`company_name` étant obligatoire dans `waitlist`, impropre à une capture
email-seul) ; dédoublonnage géré par `notified_at` côté backend (pas
seulement côté client, pour rester fiable même en cas de rechargement de
page). Skip silencieux si l'email a déjà entièrement rejoint `waitlist`.
Politique de confidentialité mise à jour (nouvelle catégorie de données,
nouvelle finalité en intérêt légitime, durée de conservation 30 jours) —
traitement analogue à une relance de panier abandonné (donnée minimale,
envoi unique, aucune conséquence pour qui ignore l'email). Purge des lignes
de plus de 30 jours ajoutée au cron quotidien existant (`cron.js`), isolée
dans son propre try/catch pour ne jamais bloquer le reste du cron en cas
d'échec.

### 🔵 Confirmation RLS `password_reset_tokens` / `bug_reports`
Signalé comme encore en attente ; la migration 050 (précédente session)
couvre déjà exactement ces deux tables (RLS activé + policy deny-all).
SQL repassé à l'utilisateur pour ré-exécution — idempotent, sans risque à
rejouer si déjà appliqué.

## 2026-08-23

### 🔴 Case RGPD waitlist/landing inopérante — pas un vrai `<input>`
Rapport de bug (test automatisé) : sur la landing page et `/waitlist`, la
case à cocher RGPD ne réagissait à aucun clic (case, label ou texte), la
soumission ne produisait ni succès ni erreur, et aucun lead n'arrivait.
Cause : `LandingPage.jsx` et `WaitlistPage.jsx` simulaient la case avec un
`<div onClick={...}>` stylé, sans lien natif avec le `<label>` englobant —
cliquer sur le texte ou le label n'atteignait jamais le gestionnaire
(seul le carré lui-même avait un onClick), et un outil d'automatisation ou
un lecteur d'écran ne voit tout simplement pas cet élément comme une case à
cocher (pas de `role="checkbox"`, pas de focus clavier). `RegisterPage.jsx`
et la nouvelle `LeadsLitigesDIPPage.jsx` utilisaient déjà un vrai
`<input type="checkbox">` — les deux pages fautives alignées sur ce modèle.
Un consentement RGPD techniquement présent mais difficilement activable
constitue par ailleurs un point de fragilité sur le fond, pas seulement un
bug ergonomique (voir garde-fou-legal : un design qui gêne l'action de
consentement affaiblit la preuve de consentement).

### 🟡 Faux-positif "BLOQUANT — Script error." filtré à la source
Rapport auto-capturé (`ErrorBoundary`/`window.onerror`) sur `/login`,
visiteur non connecté : `[CRASH AUTO] window.error : Script error.`, stack
trace pointant uniquement vers l'appel `new Error()` du gestionnaire
lui-même. Signature classique du masquage cross-origin du navigateur
(script tiers, extension, bloqueur de pub) — jamais notre propre code
(servi en same-origin) — et strictement sans valeur de diagnostic, tout en
générant une alerte "BLOQUANT" à chaque occurrence. Filtré dans
`errorJournal.js` : un `window.onerror` avec `message === 'Script error.'`
et sans `e.error` n'est plus remonté ni journalisé.

## 2026-08-22 (7)

### 🔴 Verrou global overflow-x — le correctif du bandeau seul ne suffisait pas
Le correctif précédent (bandeau de rappel dashboard) corrigeait un vrai bug
mais l'utilisateur a confirmé que le décalage horizontal persistait après
déploiement — soit un autre élément contribue au même symptôme, soit le
mécanisme exact différait de l'hypothèse initiale. Plutôt que de continuer
à traquer chaque élément large un par un (pistes identifiées mais non
confirmées : `CopilotChat.jsx` panneau `width: 380`, `FeedbackWidget.jsx`
panneau `width: 300`, tous deux inférieurs à certains viewports mobiles
étroits), verrou structurel posé directement dans `index.css` : `overflow-x:
hidden` sur `html` ET `body` (les deux, pas un seul — un seul ne suffit pas
à garantir l'absence de défilement horizontal sur tous les moteurs). Ce
verrou clippe tout débordement horizontal quel que soit l'élément fautif,
actuel ou futur, sans dépendre d'identifier la cause exacte à chaque fois.
Les zones à défilement horizontal intentionnel (`overflow-x-auto` sur la
rangée de boutons mobile de `PageHeader.jsx`, tableaux larges) restent
inchangées — un `overflow-x: auto` imbriqué continue de défiler localement
indépendamment du `hidden` posé sur ses ancêtres.

## 2026-08-22 (6)

### 🔴 Dashboard entièrement décalé sur mobile — bandeau de rappel trop large
Capture d'écran fournie par l'utilisateur sur le dashboard mobile : la page
entière apparaissait tronquée/décalée horizontalement (bandeau d'alerte,
carte de score, cartes de stats toutes coupées au même point à droite).
Cause : `CompletionReminderWidget.jsx` (le bandeau ambre « N sections du DIP
restent à compléter », `position: fixed`, centré en haut) combinait
`whiteSpace: 'nowrap'` avec un `maxWidth: calc(100vw - 32px)` — mais sans
`overflow`/`textOverflow` pour faire respecter cette largeur (contrairement
au même pattern utilisé correctement ailleurs, `OnboardingModal.jsx:557`,
qui associe toujours nowrap à `overflow: hidden` + `textOverflow:
ellipsis`). Le texte du message (icône + phrase + score + lien + croix de
fermeture, tout sur une seule ligne forcée) dépassait largement 100vw sur
un téléphone : Safari iOS élargit le viewport de mise en page pour
accommoder un élément `fixed` qui déborde, ce qui rend TOUTE la page
défilable horizontalement — d'où les cartes coupées, sans lien apparent
avec le bandeau lui-même. Corrigé en autorisant le message à passer à la
ligne (`flexWrap: 'wrap'`, retrait du `whiteSpace: nowrap`, `minWidth: 0`
sur le texte) plutôt que de le tronquer, pour ne pas perdre l'information
de score affichée dans ce bandeau.

## 2026-08-22 (5)

### 🔴 Bandes blanches — extension aux pages franchisé et au reste du SaaS
Suite du correctif précédent (bandes blanches en overscroll mobile) :
`grep "min-h-screen"` sur tout `frontend/src/pages` a trouvé 7 pages
restantes avec le même pattern (fond peint sur un `<div>` interne au lieu de
`body`/`html`). Corrigées avec `usePageBackground()` : `NotFoundPage.jsx`,
`TrialExpiredPage.jsx`, et surtout les **3 pages côté franchisé** — les
liens publics sans compte que les franchisés ouvrent sur leur téléphone
depuis un email ou WhatsApp : `AttestationPublicPage.jsx`
(`/attestation/:token`), `SharedDIPPage.jsx` (`/dip/partage/:token`),
`SharedContractPage.jsx` (`/contrat/partage/:token`). Vérifié à cette
occasion que le shell principal de l'espace connecté (avocat/franchiseur,
`components/Layout.jsx:57`) peint déjà `background: var(--page-bg)` — la
même variable que `body`, donc pas de rupture de fond au rebond de
défilement sur le dashboard ou les pages internes de l'app : ce risque
n'existait que sur les pages hors du shell principal (marketing, auth,
liens partagés), maintenant toutes couvertes.
`DIPAvocatPage.jsx` et `AvocatSessionPage.jsx` utilisent déjà les variables
de thème (`--bg-primary`) plutôt qu'une couleur figée — non concernées.

## 2026-08-22 (4)

### 🔴 Bandes blanches en haut/bas des pages publiques sur mobile
`<body>`/`<html>` sont peints via la variable CSS `--page-bg` (thème de
l'espace connecté), avec un fond clair (`#FAF6EE...`) par défaut — un
garde-fou existait déjà pour l'espace connecté (commentaire `index.css`
ligne ~212 : le rebond de défilement sur mobile découvre ce qu'il y a
derrière le fond, d'où l'exigence de peindre `html` ET `body`). Mais les 9
pages publiques (Landing, Waitlist, Login, Register, Forgot/ResetPassword,
Legal, et les 2 nouvelles pages `/ressources/*`) peignent leur propre fond
sur un `<div className="min-h-screen">` interne, sans jamais toucher à
`--page-bg` — en overscroll mobile, c'est donc le fond clair par défaut du
thème connecté qui apparaît en bandes, en rupture flagrante avec le fond
sombre de la landing page en particulier. Corrigé avec un hook réutilisable
`usePageBackground()` (`frontend/src/lib/usePageBackground.js`) qui peint
`document.body`/`documentElement` avec le fond propre à chaque page au
montage, et restaure l'état précédent au démontage — appliqué aux 9 pages
publiques concernées.

## 2026-08-22 (3)

### 🟢 Estimateur de risque DIP sur /ressources/litiges-dip
La page de capture de leads était trop mince pour un lead magnet destiné à
des avocats : ajout d'une checklist interactive « Estimez le risque du DIP
de votre client » (5 questions Oui/Non/Incertain — délai de 20 jours, preuve
datée, actualisation du DIP, avertissement prévisionnel, signalement des
faits nouveaux avant signature) qui calcule un niveau de risque indicatif
100% côté client, sans transmission au backend (les réponses ne figurent pas
dans le payload de `POST /api/leads/litiges-dip`). Chaque citation reprise
telle quelle de `legalLibrary.js` (déjà vérifiée). Résultat visible dès les
5 questions répondues — sans attendre l'envoi du formulaire, puis récapitulé
sur l'écran de confirmation une fois la ressource envoyée par email.
Vérifié par un audit garde-fou-legal dédié (RGPD, risque de conseil
juridique déguisé) : conforme, un point faible (disclaimer trop vague) a
été corrigé au passage pour reprendre la formulation exacte déjà validée
en CGU clause 3 (« ne constitue pas un conseil juridique au sens de la loi
n° 71-1130 du 31 décembre 1971 »). Rapport sauvegardé en `.docx`.

## 2026-08-22 (2)

### 🟡 Réalignement SEO + GEO sur le pivot avocats
Audit complet (structured data, robots.txt, sitemap, llms.txt, blog, maillage
interne) révélant que le pivot business vers les avocats (déjà fait sur
LandingPage.jsx et RegisterPage.jsx) n'avait pas été répercuté dans le
contenu statique servi aux crawlers : `frontend/index.html` (title, meta,
OG/Twitter, JSON-LD SoftwareApplication/Organization/WebSite, bloc
`#seo-prerender`) et `frontend/public/llms.txt` ciblaient encore les
« franchiseurs » comme clients — un LLM ou un moteur obtenait une réponse
différente sur « à qui s'adresse DIPpro » selon la page lue. Contenu
réaligné en réutilisant verbatim les textes déjà validés sur LandingPage.jsx
(FEATURES, FAQS, HOW_STEPS) plutôt qu'en inventant de nouvelles
affirmations — vérifié par un audit garde-fou-legal dédié (RGPD, pratiques
commerciales trompeuses), conforme, rapport sauvegardé en `.docx`.
Corrections complémentaires : titre dupliqué entre `/ressources/litiges-dip`
et `/ressources/base-litiges-dip` (mêmes deux pages absentes du sitemap —
ajoutées) ; pages orphelines sans lien entrant (ajout d'un lien footer sur
la landing page et d'un renvoi contextuel dans 2 articles de blog les plus
pertinents) ; `robots.txt` sans directive explicite pour les crawlers
d'entraînement IA (Google-Extended, CCBot, anthropic-ai, Applebot-Extended,
Bytespider — ajoutés en plus de GPTBot/ClaudeBot/PerplexityBot déjà
présents, effet surtout déclaratif puisque déjà couverts par `Allow: /` du
groupe `*`). Effet de bord positif détecté en vérifiant le rendu des deux
liens de blog ajoutés : `frontend/scripts/generate-blog.mjs` ne supportait
que `**gras**` et `[lien](url)`, pas `*italique*` (rendu en astérisques
littéraux) — ajouté, corrige au passage 7 occurrences préexistantes dans
d'autres articles.

## 2026-08-22

### 🟢 Module de capture de leads — Base des litiges DIP (campagne LinkedIn avocats)
Nouvelle route publique `/ressources/litiges-dip` : formulaire (nom, email pro,
téléphone, cabinet optionnel) + case de consentement RGPD non pré-cochée,
liée à la campagne LinkedIn Post 12 ciblant les avocats en droit de la
franchise. Table dédiée `leads_litiges_dip` (migration 052), volontairement
séparée de `users`/`waitlist` — un lead n'est jamais un compte client, RLS
deny-all côté client (accès service role uniquement). Le téléphone collecté
n'est utilisé que pour un contact manuel et personnalisé, jamais pour de la
prospection téléphonique automatisée (SVI/robocall), et n'est connecté à
aucun usage secondaire non déclaré (revente, enrichissement externe).
Backend `POST /api/leads/litiges-dip` (`backend/src/routes/leads.js`) :
validation, insertion horodatée du consentement, envoi de la ressource par
email (Resend) au demandeur + notification interne à Théo — rate-limité
10/h/IP. Ressource elle-même publiée en page (`/ressources/base-litiges-dip`)
plutôt qu'en PDF, construite strictement à partir du contenu déjà vérifié de
`legalLibrary.js` (tableau des sanctions + jurisprudence), sans classement de
fréquence inventé. Politique de confidentialité (`LegalPage.jsx`) étendue :
nouvelle catégorie de données, nouvelle finalité en intérêt légitime
(art. 6.1.f RGPD) pour la prospection B2B, sous-traitant Resend précisé,
durée de conservation de 3 ans à compter du dernier contact (standard CNIL).
Désinscription v1 : email `privacy@iralink-agency.com` déjà en place dans la
section « Vos droits », pas de flux self-service dédié pour l'instant.

## 2026-08-21 (2)

### 🟡 Passe mobile — tout le SaaS
Audit systématique (4 agents en parallèle, ~40 fichiers) puis correction des
points les plus sérieux/à plus fort trafic :
- **Levier le plus large** : la règle CSS globale garantissant 44px de
  hauteur tactile (`index.css`) ne couvrait que `.btn-primary`/`.btn-secondary`/
  `.btn-liquid-glass*` — `.btn-ghost`, `.btn-cta-glow` et `.lg-pill-btn*` en
  étaient absents, expliquant à eux seuls une grande partie des boutons trop
  petits trouvés dans tout le SaaS (retour d'assistant, CTA DIPAvocatPage,
  actions dashboard). Ajoutés à la règle.
- **Formulaires d'inscription** (LandingPage, WaitlistPage) : grilles 2
  colonnes fixes (`gridTemplateColumns: '1fr 1fr'`) sans repli, remplacées par
  `repeat(auto-fit, minmax(140px, 1fr))` — le motif déjà utilisé ailleurs sur
  ces mêmes pages.
- **En-têtes sans repli mobile** (WaitlistPage, LegalPage) : risque de
  débordement horizontal sur les plus petits écrans, corrigé par
  troncature/masquage des éléments secondaires + `flex-wrap`.
- **Modales d'onboarding** (OnboardingModal, OnboardingFranchiseur,
  OnboardingAvocat) : aucun scroll de secours — sur un écran court
  (iPhone SE), les boutons de navigation en bas de modale pouvaient être
  coupés sans aucun moyen d'y accéder. `overflowY: 'auto'` +
  `maxHeight: calc(100vh - 32px)` ajoutés aux trois.
- **DIPAvocatPage** : ligne d'envoi de proposition sans repli (`flex-wrap`
  ajouté), sélecteur de client sans garde-fou de largeur (`maxWidth:
  calc(100vw - 32px)`).
- **AdminPage** : grille de stats sautait de 2 à 5 colonnes sans palier
  intermédiaire.
- **FranchiseesPage** : filtres de statut passés au motif `.filter-scroll`
  déjà établi ailleurs (défilement horizontal fluide plutôt que débordement).
- **AvocatDashboard** : boutons Valider/Signaler (action principale de
  l'avocat) agrandis sur mobile.
- **UploadDIPPage/UploadContractPage** : ligne de boutons post-upload passée
  en `flex-col sm:flex-row`.
*Non traité, volume trop important pour cette passe* : de nombreux boutons
icône seuls (`p-1`/`p-1.5`) dans des listes denses (FranchiseesPage,
DIPPage, ContractPage) restent sous 44px — les corriger tous aurait cassé la
densité d'affichage de ces listes ; à revisiter par écran si un usage mobile
intensif de ces listes est confirmé.
`frontend/src/index.css`, `frontend/src/pages/{LandingPage,WaitlistPage,LegalPage,DIPAvocatPage,AdminPage,FranchiseesPage,UploadDIPPage,UploadContractPage}.jsx`, `frontend/src/components/{OnboardingModal,OnboardingFranchiseur,OnboardingAvocat}.jsx`, `frontend/src/components/dashboard/AvocatDashboard.jsx`

---

## 2026-08-21

### 🔴 RLS manquantes + secret webhook en clair (advisor Supabase)
*Trouvé* : `password_reset_tokens` avait RLS **désactivé** (pas juste sans
policy) — une table de tokens de reset de mot de passe ne doit jamais
dépendre uniquement de l'absence de GRANT pour rester privée. `bug_reports`
avait RLS activé sans policy (déjà sans faille réelle, seul le service role
y accède dans le code, mais ambigu pour l'advisor).
*Trouvé en creusant `notify_lead_email()`* (jamais créée par une migration
versionnée, recréée à la main au moins 4 fois d'après l'historique des
REVOKE ratés — 020/024/034/036) : le secret du webhook était écrit **en
clair dans le corps de la fonction**, lisible via `pg_get_functiondef()` par
tout rôle authentifié — combiné aux GRANT EXECUTE anon/authenticated qui
revenaient à chaque `CREATE OR REPLACE` manuel, le secret a probablement été
exposé.
*Correctif* : RLS activé + deny-all sur les deux tables (migration 050).
Secret déplacé vers Supabase Vault, valeur régénérée, `REVOKE` regroupé dans
la même migration que le `CREATE OR REPLACE` pour ne plus se désynchroniser
(migration 051) — `SECURITY DEFINER` conservé délibérément, nécessaire pour
que le trigger appelle `net.http_post()` quel que soit le rôle qui a
déclenché l'INSERT. Appliqué par l'utilisateur, secret Edge Function
`send-lead-email` à resynchroniser (hors dépôt, action manuelle).
`supabase/migrations/050_rls_password_reset_bug_reports.sql`, `supabase/migrations/051_notify_lead_email_secret_hardening.sql`

### 🔴 Site hors ligne — CNAME écrasé par la config Resend
*Symptôme* : site totalement inaccessible ("écran blanc" rapporté côté avocat,
puis confirmé général), 400 Bad Request via CloudFront, certificat SSL
Amazon au lieu de Vercel.
*Cause* : la configuration du domaine d'envoi Resend a remplacé le CNAME de
`iralink-agency.dippro.business` (→ Vercel) par `links1.resend-dns.com`
(infrastructure de tracking de liens Resend) — répétition de l'incident du
10/08/2026 (TXT Google Search Console), même cause racine : un enregistrement
tiers posé sur `iralink-agency` au lieu de la racine `dippro.business`.
*Diagnostic* : `curl` direct sur le domaine trompé par le cache du proxy réseau
sortant de la session (400 identiques, pris à tort pour du bruit réseau) ;
résolu en interrogeant directement `dns.google`/`cloudflare-dns.com` en
DNS-over-HTTPS, qui a révélé le CNAME détourné. Le domaine de secours
`app-dpi.vercel.app` a confirmé que le déploiement Vercel restait sain
pendant toute la panne.
*Correctif* : CNAME restauré vers `d0e3e4d5e9f7f4a2.vercel-dns-017.com.` sur
le DNS Vercel du domaine (par l'utilisateur). Site et `/api/health` de
nouveau entièrement verts. Règle ajoutée à INVARIANTS.md §6 : toute
config Resend future (SPF/DKIM/tracking) va sur la racine `dippro.business`,
jamais sur `iralink-agency`.
`docs/INVARIANTS.md`

---

## 2026-08-20 (3)

### 🔴 Migration 049 jamais donnée à l'utilisateur — santé dégradée en prod
*Symptôme* : `/api/health` → `database_schema.ok: false`,
`column users.resend_api_key does not exist`. Découvert en revérifiant que
l'envoi d'email fonctionnait après la migration Brevo→Resend.
*Cause* : la migration 049 a été committée avec le code qui en dépend, mais
jamais transmise à l'utilisateur pour exécution dans Supabase (contrairement
aux migrations 045-048 données explicitement plus tôt) — exactement le
scénario que `schemaCheck.js` existe pour détecter.
*Correctif* : SQL redonné à l'utilisateur pour exécution immédiate.
**Rappel du protocole** : toute nouvelle migration doit être donnée en SQL
complet à l'utilisateur dans le même message que sa création, jamais laissée
pour un tour suivant.

### 🟢 Bibliothèque juridique — nouvelle catégorie « Droit commercial connexe »
5 nouvelles entrées vérifiées (L.341-1, L.330-1, L.420-1 C. com., L.714-1 CPI,
1104/1194 C. civ.) — textes de loi stables uniquement, aucune nouvelle
référence de jurisprudence ajoutée (risque de fabrication déjà rencontré 2×
cette session). Étiquetée explicitement comme non vérifiée par le moteur IA,
pour ne pas laisser croire que l'analyse automatique couvre ce périmètre —
seules les catégories Socle légal/Code civil/Jurisprudence le sont.
`frontend/src/lib/legalLibrary.js`, `frontend/src/pages/AvocatBibliothequePage.jsx`

---

## 2026-08-20 (2)

### 🟢 Migration complète Brevo → Resend
DIPpro utilisait Brevo pour tout l'email transactionnel (notifications
franchisés, réinitialisation de mot de passe, invitations avocat↔franchiseur,
rapports de bugs, digests avocat) alors que le formulaire de contact utilisait
déjà Resend depuis peu — deux prestataires pour le même usage. Migration
complète vers Resend, décision du fondateur pour tout le groupe (Iralink +
DIPpro).
- Nouveau module partagé `backend/src/config/email.js` (`sendTransactionalEmail`)
  — remplace 7 implémentations dupliquées de l'appel HTTP Brevo dans
  `notifications.js`, `auth.js`, `certificates.js`, `bugs.js`, `avocat.js` (×2),
  `cron.js`, `franchisees.js`.
- Migration 049 : colonnes `resend_api_key`/`resend_sender_name`/`resend_sender_email`
  sur `users` (remplacent `brevo_*`, conservées sans purge). Un franchiseur peut
  toujours définir sa propre clé (Paramètres > Emails), désormais Resend.
- `LegalPage.jsx` : Brevo retiré des sous-traitants déclarés (CGU + privacy),
  Resend étendu pour couvrir tout l'email transactionnel — changement notable :
  Resend est basé aux USA (CCT), Brevo était basé en France/UE.
- Toute la doc mise à jour (`README.md`, `SETUP.md`, `DEPLOYMENT.md`,
  `docs/CLAUDE_DEV_GUIDE.md`, `docs/LIVRET_ERREURS.md`).
*Non fait — hors périmètre de ce dépôt* : la partie MailerLite → Resend
concernait le site vitrine iralink-agency.com (aucune trace de MailerLite
dans ce dépôt — DIPpro utilisait Brevo, pas MailerLite).

---

## 2026-08-20

### 🔴 Lien de vérification des attestations mort depuis toujours
*Symptôme* : chaque certificat PDF/DOCX imprime "Vérification en ligne :
dippro.business/attestation/{token}", mais aucune route `/attestation/:token`
n'a jamais existé côté frontend — un tiers (franchisé, juge) qui suit ce lien
tombait sur la page d'accueil (soft-404, voir plus bas), sans aucun moyen de
vérifier le document. Cassait directement la valeur probatoire "preuve de
remise incontestable" mise en avant depuis le début du projet.
*Correctif* : nouvelle page `AttestationPublicPage.jsx` (score, niveau,
empreinte SHA-256, téléchargement PDF/DOCX) branchée sur l'API publique
existante `GET /api/certificates/public/:token?format=json`, route ajoutée.
`frontend/src/pages/AttestationPublicPage.jsx`, `frontend/src/App.jsx`

### 🟡 Soft-404 — toute URL inconnue répondait HTTP 200
*Symptôme* : `curl -I` sur une URL inexistante renvoyait 200 (mauvais pour le
SEO — Google traite mal les soft-404).
*Cause* : le rewrite catch-all de `vercel.json` (`/(.*) → /index.html`,
nécessaire au routage côté client) sert index.html pour absolument tout, et
le `<Route path="*">` de React Router redirigeait silencieusement vers "/".
*Correctif* : `middleware.mjs` à la racine (Vercel Routing Middleware,
s'exécute avant les rewrites) — laisse passer API/assets/blog/fichiers
statiques/routes connues, renvoie un vrai 404 pour le reste. Côté React,
`path="*"` affiche désormais une vraie page `NotFoundPage` au lieu d'un
redirect silencieux.
**Toute nouvelle route ajoutée dans `App.jsx` doit être ajoutée à
`ALLOWED_PREFIXES` dans `middleware.mjs`, sinon elle sera bloquée par erreur** —
ajouté à `docs/INVARIANTS.md` §8.
`middleware.mjs`, `frontend/src/pages/NotFoundPage.jsx`, `frontend/src/App.jsx`

### 🟡 "Hébergé en France" / "RGPD conforme" — variantes manquées lors de l'audit du 17/08
*Symptôme* : l'audit légal du 17/08 avait corrigé ces formulations sur la
landing page et l'index.html prerendu, mais un grep plus large a trouvé 7
occurrences supplémentaires non couvertes par les motifs de recherche
d'origine (casse différente, "hébergées" au pluriel, clé i18n `shared.badges.rgpd`
utilisée par les pages de partage public, mentions légales elles-mêmes
disant AWS eu-west-1 = "France" alors que c'est l'Irlande).
*Correctif* : `LegalPage.jsx` (eu-west-1 → Irlande), `SharedDIPPage.jsx`,
`SharedContractPage.jsx`, `WaitlistPage.jsx`, `OnboardingModal.jsx`,
`i18n/locales/{fr,en}.json` (clé `shared.badges.rgpd` + `common.security`).

---

## 2026-08-20

### 🟢 Moteur juridique — outil tout-en-un avocat
Fusion de 3 onglets avocat en un seul (« Recherche conformité » supprimé, absorbé
dans « Bibliothèque juridique » renommée « Moteur juridique ») : recherche
instantanée dans le référentiel, bandeau de conformité live du client actif
(score, alertes, délai 20j — via `computeLiveCompliance`), et assistant IA
pour les questions hors référentiel statique, sur une seule page au lieu de
trois. L'ancienne URL `/avocat/:id/recherche` redirige proprement plutôt que
de tomber sur une route morte.
Référentiel enrichi : art. L.341-2 C. com. (plafond légal d'un an pour la
clause de non-concurrence post-contractuelle) — absent du référentiel ET du
prompt d'analyse de contrat, qui vérifiait la clause sans base légale précise
pour juger sa durée. Ajouté aux deux, plus au prompt système contrat.
En passant : une citation incertaine (Cass. 1re civ. 25 janv. 2017, n°15-28.064,
déjà retirée du reste du corpus lors de l'audit du 17/08) traînait encore dans
le tableau des sanctions de `legalLibrary.js`, appliquée à tort à un point sans
rapport — retirée.
`frontend/src/pages/AvocatBibliothequePage.jsx`, `frontend/src/lib/legalLibrary.js`, `frontend/src/components/avocat/AvocatClientShell.jsx`, `frontend/src/App.jsx`, `backend/src/config/claude.js`, `docs/LEGAL_COPY.md`
Page supprimée : `frontend/src/pages/AvocatCompliancePage.jsx` (fusionnée).

---

## 2026-08-19

### 🟡 Dashboard avocat verrouillé sur le thème Sobre
*Symptôme* : le sélecteur de thème (Sobre/Glass/Lumière) dans la Sidebar n'avait
aucun effet une fois sur les pages avocat (Dashboard, Fichiers, DIP client,
AvocatClientShell).
*Cause* : ces 4 fichiers posaient `data-theme="sobre"` directement sur leur
propre conteneur — un attribut `[data-theme]` sur un descendant l'emporte
toujours sur celui posé par `ThemeContext` sur `<html>`, quel que soit le choix
réel de l'utilisateur dans le sélecteur.
*Correctif* : attribut retiré des 4 fichiers — les pages avocat suivent
désormais le thème global comme le reste de l'app. « Sobre » reste un thème
sélectionnable au même titre que Glass/Lumière, simplement plus l'unique
possibilité imposée côté avocat.
`frontend/src/components/dashboard/AvocatDashboard.jsx`, `frontend/src/components/avocat/AvocatClientShell.jsx`, `frontend/src/pages/{DIPAvocatPage,AvocatFilesPage}.jsx`

---

## 2026-08-17 (7)

### 🟢 Annexes au niveau du document (plus par section)
Migration 048 : `position` ajouté à `dip_section_annexes`, contrainte CHECK
remplacée pour exiger `dip_id` ou `contract_id` (recherche dynamique des noms
de contraintes anonymes — pas de nom deviné). Routes remplacées :
`POST/GET /avocat/dip/:dipId/annexes` et `/avocat/contract/:contractId/annexes`.
`DIPAvocatPage.jsx` : la zone d'annexes n'apparaît plus par trame mais une
seule fois, à la fin du document (« Annexe 1 », « Annexe 2 »... dans l'ordre
d'ajout) — conforme à la structure d'un acte juridique réel.
`AvocatFilesPage.jsx` : dossier « Annexes » désormais au même niveau que
« DIP » et « Certificats », plus imbriqué par section.
Voir INVARIANTS.md §4bis.

### 🟢 « Envoyer au client » — document + email en un geste
Nouvelles routes `POST /avocat/dip/:dipId/send-to-client` et
`/avocat/contract/:contractId/send-to-client` : génèrent le PDF à jour et
l'envoient en pièce jointe réelle via Resend (pas un `mailto:`, qui ne peut
pas joindre de fichier) à un destinataire **entièrement choisi par
l'avocat** — client franchiseur, candidat-franchisé ou toute autre adresse.
Objet et message ont des valeurs par défaut sensées, modifiables.
Génération PDF extraite de `export.js`/`contracts.js` vers
`backend/src/config/documentPdf.js`, réutilisée par les routes d'export
existantes (comportement inchangé, vérifié par génération réelle de PDF)
pour ne pas maintenir deux versions divergentes du même document.
Bouton "Envoyer au client" à côté d'"Export PDF" dans `DIPAvocatPage.jsx`.
`backend/src/config/documentPdf.js`, `backend/src/routes/{avocat,export,contracts}.js`, `frontend/src/pages/DIPAvocatPage.jsx`

---

## 2026-08-17 (6)

### 🟢 Landing page repensée pour un acheteur avocat
Hero, mockup, fonctionnalités mises en avant, étapes, FAQ, tarification et
footer réécrits autour du portefeuille multi-clients plutôt que d'un DIP
unique : score moyen, contrôle de validation, explorateur de fichiers,
compte-rendu automatique — les fonctionnalités livrées dans ce pivot,
pas des promesses. Prix inchangé (1 300 € + 850 €/mois) mais reframé
« par cabinet, clients illimités » plutôt qu'inventé. Toute occurrence
« Hébergé en France » / « vos franchisés » corrigée en cohérence avec
l'audit légal du jour. Formulaire liste d'attente : « Société » → « Cabinet ».
*Décision non prise à ma place, à trancher par le fondateur* : le prix
affiché est celui hérité du modèle franchiseur — aucune donnée sur la
disposition à payer des avocats n'existe dans ce projet, donc aucun nouveau
chiffre n'a été inventé.
`frontend/src/pages/LandingPage.jsx`

---

## 2026-08-17 (5)

### 🟢 L'avocat invite ses clients franchiseurs (inversion du sens d'inscription)
Migration 047 : `franchiseur_access_token` sur `users`, miroir exact de
`avocat_access_token` (038). Nouvelle route `POST /avocat/invite-franchiseur`
et `GET /auth/franchiseur-login/:token`, copies conformes de
`POST /avocat/invite` / `GET /auth/avocat-login/:token` avec les rôles
inversés — accès sans mot de passe, magiclink régénéré à chaque visite via
`AvocatSessionPage` (déjà générique, réutilisée telle quelle).
Carte « Inviter un client franchiseur » dans le dashboard avocat.
`RegisterPage.jsx` : l'écran de sélection de profil est retiré — l'inscription
publique va désormais directement au formulaire avocat (`?role=franchiseur`
reste accepté pour un lien d'invitation existant, mais n'est plus un point
d'entrée public). Panneau gauche (accroche, bénéfices) adapté au profil avocat.
*Volontairement conservé sans modification* : `POST /avocat/invite`
(franchiseur invite son avocat) reste fonctionnel pour les comptes existants —
aucun retrait de fonctionnalité, seulement plus mis en avant.
`supabase/migrations/047_franchiseur_invite.sql`, `backend/src/routes/{avocat,auth}.js`, `frontend/src/pages/RegisterPage.jsx`, `frontend/src/components/dashboard/AvocatDashboard.jsx`

---

## 2026-08-17 (4)

### 🟢 Analyse programmée avocat (compte-rendu automatique)
Migration 046 : `avocat_digest_frequency` (off/weekly/daily) et
`avocat_digest_channel` (email/inapp/both) sur `users`, table `avocat_digests`
(historique, deny-all RLS — écrit uniquement par le service role). Le cron
quotidien existant (`cron.js` étape 5) recalcule le score de conformité live
de chaque client via `computeLiveCompliance` — **aucun appel IA
supplémentaire** — et génère un compte-rendu par section/loi (référence
`LEGAL_REFS`, extrait de `claude.js` vers `config/dipSections.js` partagé
pour rester synchronisé). Envoi email via Brevo si canal `email`/`both`.
Carte « Automatisation » dans le dashboard avocat : fréquence, canal,
historique des 5 derniers comptes-rendus.
`supabase/migrations/046_avocat_digest.sql`, `backend/src/routes/{cron,avocat}.js`, `backend/src/config/dipSections.js`, `frontend/src/components/dashboard/AvocatDashboard.jsx`

---

## 2026-08-17 (3)

### 🟢 Explorateur de fichiers avocat
Nouvel onglet « Fichiers » (`/fichiers`) : arborescence Mes franchiseurs > [client] >
DIP > Section 1..N (+ annexes jointes) et Certificats, par client, en chargement
différé au dépli (pas de gros appel agrégé au chargement de la page). Les sections en
attente de validation avocat (`avocat_validation_status = 'pending'`) sont mises en
évidence en rouge directement dans l'arbre.
`GET /avocat/franchiseur/:id/dip` étendu pour inclure les annexes de chaque section
en un seul aller-retour.
`frontend/src/pages/AvocatFilesPage.jsx`, `backend/src/routes/avocat.js`, `frontend/src/components/Sidebar.jsx`

---

## 2026-08-17 (2)

### 🔴 Audit légal pré-pivot avocat (skill garde-fou-legal)
*Demande* : avant de vendre à des avocats (audience zéro tolérance à l'approximation),
auditer chaque affirmation du site. Verdict : le site ne pouvait pas être montré
en l'état.
*Trouvé et corrigé, par gravité* :
- **Citation de jurisprudence très probablement fabriquée** — « Cass. com., 4 déc. 2024,
  Lady Moving/Fitness Park Development » — présente jusque dans le **prompt système de
  l'IA** (`claude.js`, 2 occurrences), dans `legalLibrary.js` (bibliothèque avocat) et
  2 articles de blog. Seule citation du corpus sans lien Légifrance vérifiable. Supprimée
  partout ; on s'appuie uniquement sur Cass. com., 26 juin 2024, n°23-14.085 (vérifié).
- **Deux obligations légales inventées**, citées avec un article de loi précis :
  « notification sous 20 jours » de toute modification (n'existe pas, absent aussi de la
  logique backend) et « expiration annuelle obligatoire » du DIP (Loi Doubin n'impose
  aucun renouvellement annuel — `alerts.js` générait littéralement cette fausse
  obligation avec citation d'article). Reformulées en bonnes pratiques recommandées,
  jamais en obligations légales.
- **Contradiction RGPD interne** : « aucune donnée partagée avec des tiers » / « Hébergé
  en France » contredits par les CGU elles-mêmes (Anthropic, Vercel — USA). Corrigé
  partout (landing, waitlist, index.html ×2, llms.txt).
- **Chiffre commercial non sourcé** (200 000 €/litige, ×17 ROI) répété ~10 fois pour
  justifier le prix. Retiré ; le panneau ROI de la landing page est reformulé sans
  statistique inventée.
- **Base légale obsolète incohérente** : Décret n°91-337 (1991) cité seul sur la moitié
  du corpus alors que la version en vigueur résulte du décret n°2023-1394 (2023) —
  déjà établi ailleurs dans le même corpus. Généralisé partout (claude.js, landing,
  llms.txt, index.html, DIPPage.jsx, 3 articles de blog, email de notification
  franchisé dans `certificates.js`).
- **Deux citations « à vérifier »** (Cass. 1re civ. 25 janv. 2017 n°15-28.064 ;
  CA Paris 22 mai 2024 n°22/08672) — recherche externe inconclusive sur les numéros de
  pourvoi exacts. Retirées par prudence (le principe juridique sous-jacent, lui,
  reste vrai et conservé), conformément à la règle « si on n'est pas sûr, on ne met pas ».
*Champ élargi au-delà des 6 fichiers audités* : un grep de contrôle a trouvé les mêmes
motifs dans `OnboardingTour.jsx`, `DIPPage.jsx`, `WaitlistPage.jsx` et surtout
`legalLibrary.js` (la bibliothèque consultée directement par les avocats) — tous corrigés.
*Non traité (nécessite une donnée externe)* : société non immatriculée — déjà documenté
le 2026-08-15, reste la seule action encore entre les mains du fondateur.
`backend/src/config/claude.js`, `backend/src/routes/{alerts,certificates}.js`,
`frontend/src/{pages/LandingPage,pages/WaitlistPage,pages/DIPPage,lib/legalLibrary,components/OnboardingTour}.jsx`,
`frontend/index.html`, `frontend/public/llms.txt`, `frontend/content/blog/*.md`

---

## 2026-08-17

### 🟢 Pivot avocat-payeur — validation avocat des éditions franchiseur
Migration 045 : `avocat_validation_status` sur `dip_sections`/`contract_clauses`
(`n/a`/`pending`/`validated`/`flagged`) + `avocat_franchiseurs.validation_mode`
(`strict`/`alerte`, choisi par l'avocat). Toute édition directe du franchiseur
repasse en `pending` ; en mode strict, `computeLiveCompliance` ne compte plus
une section « conforme » comme telle tant que l'avocat n'a pas validé. Nouvelles
routes `PATCH /avocat/sections/:id/validate`, `/avocat/clauses/:id/validate`,
`GET /avocat/pending-validations`, `PATCH /avocat/franchiseur/:id/validation-mode`.
Dashboard avocat : score de conformité moyen du portefeuille, liste des
validations en attente avec actions Valider/Signaler, sélecteur de mode par
client. Voir INVARIANTS.md §3bis.
`supabase/migrations/045_avocat_validation_gate.sql`, `backend/src/routes/{dip,contracts,avocat,compliance}.js`, `backend/src/middleware/avocatScope.js`, `frontend/src/components/dashboard/AvocatDashboard.jsx`

---

## 2026-08-16

### 🟢 Formulaire de contact public (Resend)
Nouvelle route `POST /api/contact` (`backend/src/routes/contact.js`, montée dans
`server.js` avec un rate limiter dédié — 10/h/IP) : envoie un email via l'API
Resend (`RESEND_API_KEY`) vers `RESEND_CONTACT_TO_EMAIL`, `reply_to` réglé sur
l'email du visiteur. Aucune donnée persistée en base — le message transite
uniquement par Resend.
Frontend : le bouton « Contacter l'équipe » de la landing page ouvre désormais
un formulaire inline (`ContactFormDark`) au lieu d'un lien `mailto:`.
Déclaré comme sous-traitant dans les CGU (§14), la politique de confidentialité
(§2 données collectées, §3 bases légales, §4 sous-traitants).
`backend/src/routes/contact.js`, `backend/src/server.js`, `frontend/src/pages/LandingPage.jsx`

---

## 2026-08-15

### 🟡 Audit juridique CGU / mentions légales / cookies
*Demande* : minimiser le risque de sanction lié aux pages légales.
*Trouvé et corrigé* :
- CGU §9 : la clause « protection contre les réclamations abusives » tentait
  d'interdire par contrat la saisine de la CCI ou du Médiateur des
  entreprises — un vrai risque de déséquilibre significatif (art. L.442-1
  C. com., applicable en B2B). Réécrite pour ne plus fermer ces voies de
  recours.
- Vercel Analytics (ajouté le 08-14) n'apparaissait dans aucun sous-traitant
  déclaré ni dans la politique de cookies. Ajouté partout (CGU §14, privacy
  §3/§4, cookies §2) avec la mention « sans cookie, données agrégées ».
*Non corrigé — nécessite une donnée que je n'ai pas* : les mentions légales
restent incomplètes (nom de famille, adresse, SIRET) tant qu'Iralink Agency
n'est pas immatriculée. C'est le vrai risque de sanction LCEN (jusqu'à 1 an
d'emprisonnement / 75 000 € pour une personne physique) — l'obligation
s'applique dès que le site est public, pas seulement à l'ouverture
commerciale. Recommandation : publier en nom propre (auto-entrepreneur,
SIRET obtenu en quelques jours) en attendant l'immatriculation RCS.
`frontend/src/pages/LegalPage.jsx`

---

## 2026-08-10

### 🟢 Bibliothèque juridique avocat
Nouvel onglet dans l'espace avocat : référentiel consultable des textes
(L.330-3, R.330-1 alinéa par alinéa, R.330-2), du Code civil (1112-1, vices du
consentement), de la jurisprudence clé (2007 → 2025) et du champ d'application
(quasi-exclusivité, L.442-1), avec recherche instantanée, filtres par catégorie,
liens Légifrance et tableau récapitulatif des sanctions.
`frontend/src/lib/legalLibrary.js`, `pages/AvocatBibliothequePage.jsx`
> Contenu aligné sur `backend/src/config/claude.js` — l'avocat lit exactement
> les règles appliquées aux DIP de ses clients. **À garder synchronisé.**

### 🟡 Artefacts visuels au survol
*Symptôme* : au passage de la souris, le contenu semblait « sortir » de sa case.
*Cause* : les `translateY(-2px)` / `translateX(2px)` au survol faisaient glisser
le reflet supérieur et l'ombre hors du cadre.
*Correctif* : suppression de tous les déplacements au survol (cartes, liens de
navigation, boutons, pastilles) ; retour visuel par bordure et ombre seules.

### 🟢 Jauge de conformité repensée
Arc ouvert à 270°, dégradé sémantique (vert / ambre / rouge selon le niveau,
l'or restant réservé à l'identité), animation d'entrée avec compteur, respect de
`prefers-reduced-motion`.

### 🟢 Détection des migrations non appliquées
`/api/health` vérifie que toutes les colonnes dont le code dépend existent
réellement (10 tables). Une migration oubliée devient un health check dégradé
immédiat au lieu d'heures de pertes silencieuses.
`backend/src/config/schemaCheck.js`

### 🟢 Numérotation des attestations (migration 044)
Numéro séquentiel sans trou par franchiseur, attribué par trigger atomique
(compteur dédié, pas de `MAX+1`), contrainte d'unicité, backfill chronologique
de l'existant. Numéro affiché sous le titre du PDF, en pied de chaque page, dans
le DOCX et dans les deux listes d'attestations.
> **Valeur probatoire** : une série continue prouve qu'aucune modification n'a
> été dissimulée — un numéro manquant serait immédiatement visible.

### 🔴 URL de vérification des attestations
*Symptôme* : aucun, jusqu'à ce qu'un tiers suive le lien imprimé.
*Cause* : URL figée sur `dippro.fr`, domaine qui n'est pas celui de
l'application → un juge suivant le lien n'aurait rien trouvé.
*Correctif* : passage par `getAppUrl()`. Ajout de la pagination « Page X / Y »
et de l'empreinte SHA-256 en pied de page.

---

## 2026-08-09

### 🔴 Extraction PDF totalement cassée (Node 22)
*Symptôme* : « bad XRef entry » sur toute analyse de PDF, y compris des fichiers
parfaitement valides.
*Cause* : les quatre moteurs pdf.js embarqués par `pdf-parse` (2017-2018)
échouent tous sous Node 22 ; la montée de runtime de Vercel a tué l'extraction
PDF de tout le SaaS.
*Correctif* : module partagé `config/textExtract.js` sur `pdfjs-dist` v4,
remplaçant 5 implémentations dupliquées. Message actionnable pour les PDF
réellement endommagés.
> **Règle** : après toute montée de version Node, retester un upload PDF réel.

### 🔴 `resolveScopedUserId` ne s'activait jamais
*Symptôme* : toutes les pages avocat (Certificats, Documents, Surveillance,
Conformité) affichaient un espace vide.
*Cause* : test de `req.user.role`, alors que le middleware n'y place jamais le
rôle → comparaison à `undefined`, branche avocat jamais empruntée.
*Correctif* : rôle relu en base. Vérifié sur 5 cas.

### 🟡 Cache de rôle verrouillant un compte
Un cache qui refuse invalide désormais et relit la base avant de rejeter — un
rôle corrigé en base laissait sinon l'utilisateur bloqué 5 minutes.

### 🔴 Certificats bloqués en « pending » pour toujours
*Cause* : l'étape finale écrivait `status: 'done'`, valeur refusée par la
contrainte CHECK ; l'`UPDATE` échouait **silencieusement**.
*Correctif* : `'generated'` + journalisation de l'erreur de finalisation.

### 🟡 Certificats manquants sur 4 chemins de modification
Ajoutés sur : validation d'alerte, édition directe de clause, acceptation d'une
proposition d'avocat sur clause, DIP généré par IA (attestation INITIALE).

### 🟡 Page Conformité déconnectée du réel
Lisait `compliance_level`/`conformity_score` stockés — nuls pour les DIP générés,
périmés après édition manuelle. Recalcul en direct depuis les statuts réels
(`computeLiveCompliance`), vérifié sur 7 cas.

### 🔴 Accès admin « perdu »
*Cause* : le profil frontend venait d'une lecture RLS qui, en cas d'échec ou de
timeout, retombait silencieusement sur un cache navigateur périmé — l'interface
divergeait de ce que le backend autorise.
*Correctif* : repli sur `/auth/me` (autoritaire) ; une panne réseau n'efface
plus le profil en mémoire.

### 🟡 Changement de rôle sur son propre compte
Interdit depuis la console admin : basculer son compte principal en `avocat`
faisait disparaître toutes ses données de la vue. `invalidateRoleCache()`
appelé après tout changement de rôle.

### 🔴 Lien d'accès avocat non fonctionnel
*Cause* : `verifyOtp` appelé avec `email` **et** `token_hash` — le SDK Supabase
donne priorité à `email` et attend alors un code court, ignorant le hash.
*Correctif* : `token_hash` seul. Suppression du flux générique redondant.

### 🟡 Exactitude juridique
Correction de la mauvaise attribution de Cass. com. 26 juin 2024 (page
d'accueil, FAQ, 2 articles de blog) ; sous-dispositions R.330-1 exactes ;
interdiction du wording « nullité automatique » dans les prompts ; libellés
centralisés dans `frontend/src/lib/legalCopy.js` + `docs/LEGAL_COPY.md`.

### 🟡 Allégation trompeuse sur le délai de 20 jours
Le tutoriel affirmait que la règle était « calculée automatiquement » — rien ne
la calculait. Texte corrigé, puis fonctionnalité réellement implémentée.

---

## 2026-08-08

### 🟢 Suivi du délai légal de 20 jours (migration 042)
Champs `candidate_type` (création / reprise), `dip_delivered_at`,
`planned_signature_date` par franchisé ; calcul du délai, badge de conformité,
alerte automatique si le délai légal n'est pas respecté.

### 🟢 Veille réglementaire analysée
Les flux RSS sont analysés une fois par article par le cron (mise en cache dans
`regulatory_news_cache`), avec aperçu et niveau d'impact, et création d'alerte
pour chaque franchiseur quand l'impact est élevé ou critique.

### 🔴 Alertes invisibles
`GET /alerts` excluait toute alerte rattachée au seul `user_id` (sans
`dip_id`/`contract_id`) — les alertes de délai et de veille n'apparaissaient
jamais. Filtre corrigé.

### 🟢 Hub Conformité
Page consolidée (franchiseur `/conformite`, onglet dédié côté avocat) :
alertes, violations du délai, reprises en cours, veille à fort impact.
Également présent en section compacte sur le tableau de bord.

### 🟢 Espace avocat dédié
Certificats, Documents, Export, Surveillance, Recherche conformité, scopés au
client sélectionné via `resolveScopedUserId`.

### 🟢 Upload de documents simplifié
Zone de dépôt unique multi-fichiers ; l'IA reconnaît le type de chaque document
et le classe automatiquement.

### 🔵 Suppression de la page Intégrations
Page, routes backend (OAuth Drive/OneDrive), entrées de menu et traductions
retirées.

---

## Antérieur

Voir [BUG_JOURNAL.md](BUG_JOURNAL.md) — historique complet des incidents par
catégorie, avec les motifs récurrents du projet.
