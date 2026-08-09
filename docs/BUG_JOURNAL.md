# Journal de bugs — DIPpro

Recense tous les incidents corrigés depuis le début du projet, leur cause
racine et le garde-fou mis en place pour empêcher qu'ils ne se reproduisent.
Objectif : que chaque nouvelle session (humaine ou IA) qui touche à ce code
sache déjà ce qui a cassé, pourquoi, et ce qui protège contre une rechute —
plutôt que de redécouvrir le même bug sous une autre forme.

**Comment l'utiliser** :
- Avant de toucher à une zone du code, chercher son nom ici (`Ctrl+F`).
- Après avoir corrigé un nouveau bug, ajouter une ligne dans la bonne
  catégorie (ou en créer une) selon le même format.
- La section [Motifs récurrents](#motifs-récurrents--règles-permanentes) liste
  les catégories qui sont revenues plusieurs fois — ce sont les zones à
  surveiller en priorité sur tout futur changement.

---

## Motifs récurrents — règles permanentes

Ces catégories ont produit plusieurs incidents distincts avant qu'un garde-fou
structurel (pas juste un correctif ponctuel) ne les arrête. Règle à respecter
sur tout code touchant à ces zones :

| Motif | Occurrences | Garde-fou en place aujourd'hui |
|---|---|---|
| **Chunk JS périmé après déploiement** | 5 (958663b, 85c8b0f, b282461, ccd8389, 38d336c) | `lib/chunkRecovery.js` (détection multi-navigateur incl. Safari) + rechargement auto par route + détecteur proactif `versionWatch.jsx` + `<ErrorBoundary>` sur **toutes** les routes (y compris publiques) via le wrapper `S()` |
| **Liaison avocat ↔ franchiseur** | 6 (76b67e4, f006a06, 0d87d11, a7757bc, 2b18fca, d3f1430) | Le franchiseur invite par email depuis Réglages ; le compte est provisionné automatiquement sans mot de passe, lié tout de suite (`avocat_franchiseurs.status='active'`), aucune étape d'inscription côté avocat, aucun arbitrage admin nécessaire |
| **Erreurs masquées par des messages génériques** | 3 (9fcb314, 91f98f5, 10b29ee) | L'intercepteur axios (`lib/api.js`) ne réécrit plus jamais un message d'erreur backend réel par un texte générique — toujours vérifier `err.message` avant d'écrire un fallback statique |
| **RLS/sécurité DB découverte en retard sur un rapport de santé** | 5 (c865690, 3e8356d, 64a8119, 0c18478, 57500e9/041) | Chaque migration de sécurité doit être **appliquée** (pas seulement écrite) et **revérifiée** via `get_advisors` avant de la considérer close — plusieurs correctifs ont dû être réappliqués car `CREATE OR REPLACE FUNCTION` réinitialise les grants, ou parce que la migration n'avait jamais tourné en prod |
| **URLs générées pointant vers un mauvais domaine** | 2 (6770809, a7757bc) | `backend/src/config/appUrl.js` — `getAppUrl()` unique, filtre tout hostname `*.vercel.app` avant de faire confiance à une variable d'env, fallback fixe sur le domaine de prod |
| **Migration écrite mais jamais appliquée** | 3 (avocat_access_token, signature_image, RLS 040/041) | Toujours vérifier `list_migrations` (ou demander à l'utilisateur d'exécuter le SQL fourni) après avoir écrit une migration — l'écrire dans le repo ne suffit pas |

---

## 1. Déploiement, build & rechargement de page

| Date | Symptôme | Cause racine | Correctif | Commit |
|---|---|---|---|---|
| 2026-07-14 | `FUNCTION_INVOCATION_FAILED` sur toutes les routes `/api/*` après une mise à jour | `require('compression')` absent du `package.json` racine (celui que Vercel utilise pour builder la fonction serverless) — présent seulement dans `backend/package.json` | Ajout de la dépendance au `package.json` racine | c48c36a |
| 2026-07-14 | Même symptôme, cause différente | `supabase.js` levait une exception au chargement du module si une variable d'env manquait — une seule var manquante tuait toute la fonction serverless | Ne plus crasher au chargement ; logger les vars manquantes, laisser `/api/health` les détailler | 9d53cd0 |
| 2026-07-13, 2026-07-22, 2026-08-03, 2026-08-04 | `ChunkLoadError` / page blanche après un déploiement, formulé différemment selon le navigateur (Chromium vs **Safari**, formulation totalement différente : `"'text/html' is not a valid JavaScript MIME type..."`) | Après chaque déploiement Vite les hash de fichiers JS changent ; un onglet resté ouvert référence un chunk qui n'existe plus. Le rechargement auto existait mais (a) utilisait un seul flag de session pour tout l'onglet, bloquant les pages suivantes, (b) ne reconnaissait pas la formulation Safari, (c) `vite:preloadError` ne faisait que logger sans jamais recharger, (d) **aucune page publique** (landing, login, liens de partage) n'avait d'`ErrorBoundary` du tout | `lib/chunkRecovery.js` partagé, garde par route (pas par session), détection Safari ajoutée, `vite:preloadError` recharge réellement, `ErrorBoundary` intégré au wrapper `S()` de **toutes** les routes | 958663b, 85c8b0f, b282461, ccd8389 |
| 2026-08-04 | Rapports de crash arrivant après un déploiement mais concernant un hash déjà remplacé | Aucun mécanisme ne prévenait qu'un onglet tournait sur une version périmée avant qu'il ne plante | `lib/versionWatch.jsx` : vérifie toutes les 5 min / au retour de focus si le hash servi par `/` a changé, propose un rechargement avant même de heurter une route cassée | 38d336c |

## 1b. Dépendances cassées par une montée de runtime

| Date | Symptôme | Cause racine | Correctif | Commit |
|---|---|---|---|---|
| 2026-08-09 | « bad XRef entry » sur **toute** analyse de PDF (DIP, contrat, documents, monitoring) — y compris des fichiers parfaitement valides | Les 4 moteurs pdf.js embarqués par `pdf-parse` (builds 2017-2018) plantent tous sous **Node 22** ; la montée de runtime des fonctions Vercel a tué silencieusement l'extraction PDF de tout le SaaS. Reproduit localement avec un PDF fraîchement généré par pdfkit | Module partagé `config/textExtract.js` sur `pdfjs-dist` v4 (maintenu, récupération xref intégrée), remplaçant 5 implémentations dupliquées ; message d'erreur actionnable pour les PDF réellement endommagés. **Règle : après toute montée de version Node (locale ou Vercel), re-tester l'upload PDF — c'est la dépendance la plus fragile du projet** | 85648c3 |

## 2. Authentification & sessions

| Date | Symptôme | Cause racine | Correctif | Commit |
|---|---|---|---|---|
| 2026-07-02 | Le lien de réinitialisation de mot de passe n'atterrissait jamais sur le bon écran | Supabase consomme et efface `location.hash` avant que React ne s'affiche | `INITIAL_HASH` capturé au chargement du module, avant `createClient()` | d7bc482, d119886, 4e732a2 |
| 2026-07-03 | Mot de passe oublié échouait pour certains comptes | Utilisait `listUsers()` (paginé, incomplet) au lieu d'une requête directe sur `users` | Requête directe par email | 396d520 |
| 2026-07-14 | A2F contournable | `authMiddleware` vérifiait la signature du JWT mais jamais le claim `aal` — un token aal1 (juste après le mot de passe, avant le TOTP) passait déjà toutes les routes protégées | Vérification du claim `aal`, rejet 401 `MFA_REQUIRED` si aal2 attendu et absent, mis en cache 5 min par utilisateur | 258afb6 |
| 2026-07-12 | Échec ~90 % des appels IA (analyse DIP, génération contrat...) | Avec `thinking: {type:'adaptive'}`, `content[0]` est un bloc *thinking*, pas texte — `.text` levait une `TypeError` | `extractText()` retrouve le bloc texte quelle que soit sa position ; retry JSON ajouté | aadd789 |
| 2026-07-20 | "La connexion avocat ne finit jamais" | `register()` créait le compte côté backend mais n'ouvrait jamais de session navigateur — `user` restait `null`, redirection vers `/dashboard` renvoyait vers la landing page | `register()` appelle `signInWithPassword` juste après la création du compte | 4c9cc76 |
| 2026-08-03 | `[CRASH AUTO] unhandledrejection : Lock was stolen by another request` sur `/dip` | Course interne à supabase-js (Web Locks API) entre onglets/appels concurrents — bénigne, déjà filtrée en interne pour le tick de rafraîchissement auto, mais pas pour nos appels directs (`getSession`, MFA) | Détection + suppression silencieuse au niveau du handler global `unhandledrejection`, plus de faux rapport "bloquant" | b282461 (et un premier correctif partiel en 4c9cc76) |
| 2026-08-03 | Un compte avocat de plus de 5 jours était bloqué hors de son propre tableau de bord | `trial_expires_at` fixé à 5 jours pour **tous** les comptes y compris avocat ; `isTrialExpiredFn`/`TrialGuard` n'exemptait que `admin` | Rôle avocat exempté partout, plus de `trial_expires_at` fixé à l'inscription pour ce rôle | 2b18fca |
| 2026-07-21 | Un changement de rôle en base restait invisible dans l'UI (ex: lien "Admin" absent) tant que l'utilisateur ne se reconnectait pas | Le profil n'était chargé qu'au login initial, jamais rafraîchi pendant une session SPA longue | Rafraîchissement du profil toutes les 60s | 396702f |

## 3. Liaison avocat ↔ franchiseur *(motif le plus récurrent du projet)*

| Date | Symptôme | Cause racine | Correctif | Commit |
|---|---|---|---|---|
| 2026-07-19 | 4 chemins différents pour lier un avocat, 3 étaient des culs-de-sac | Email d'invite pointait vers un paramètre `?role=` jamais lu par `RegisterPage` ; l'onboarding créait des relations `pending` sans aucun flux pour les faire passer `active` | Unification autour d'un seul lien d'invitation fonctionnel | 76b67e4 |
| 2026-07-30 | Les comptes avocat inscrits recevaient quand même le rôle `franchiseur` | `createUser()` déclenche un trigger qui insère déjà une ligne `public.users` (rôle par défaut) ; l'`INSERT` applicatif suivant entrait en conflit de clé primaire et échouait **silencieusement** (juste un `console.warn`) — le rôle/nom/consentement soumis étaient perdus au profit des valeurs du trigger | `.insert()` → `.upsert(..., {onConflict:'id'})` sur les 3 points de création de compte | f006a06 |
| 2026-07-30 | Un avocat connecté voyait toutes les pages réservées franchiseur, avec des 403 partout | La sidebar/le routeur n'excluaient pas le rôle avocat des routes franchiseur | Navigation minimale pour ce rôle, redirection si route atteinte directement | 0d87d11 |
| 2026-07-25, 2026-08-02 | Le lien envoyé à l'avocat atterrissait sur la page de connexion **de Vercel**, pas sur DIPpro | `APP_URL`/`FRONTEND_URL` pouvait pointer vers une URL de preview Vercel protégée par SSO, et gagnait sur le fallback de prod dans 15 endroits différents | `getAppUrl()` centralisé, filtre tout hostname `*.vercel.app` | 6770809, a7757bc |
| 2026-08-03 | Contradiction : le franchiseur devait *deviner* comment donner accès, ou passer par l'admin | Aucun flux de provisioning automatique n'existait — seulement un lien générique nécessitant une inscription manuelle avec mot de passe | Lien d'accès permanent sans mot de passe, géré depuis la console admin (première itération) | 2b18fca |
| 2026-08-06 | *Correction du choix ci-dessus, sur retour explicite* : l'attribution ne doit **jamais** dépendre d'un arbitrage admin | Le modèle admin-décide-qui-est-l'avocat-de-qui ne correspond pas à la façon dont un franchiseur travaille réellement | `POST /avocat/invite` provisionne et lie **automatiquement** dès que le franchiseur saisit un email — zéro étape intermédiaire, zéro mot de passe, zéro admin | d3f1430 |
| 2026-08-09 | « Toute ma data a disparu » sur le compte principal + « Accès réservé aux franchiseurs » sur l'analyse DIP | Le compte principal a été basculé en rôle `avocat` (dropdown de rôle de la console admin, seul chemin non protégé — les flux d'invitation refusent déjà les comptes existants d'un autre rôle). Rien n'était supprimé : les données étaient juste invisibles pour ce rôle. Aggravé par le cache de rôle backend (5 min) jamais invalidé | Interdiction de modifier le rôle de **son propre** compte via l'admin + `invalidateRoleCache()` appelé après tout changement de rôle. Pour tester un rôle : compte séparé (`theo+avocat@...`) | (ce commit) |

## 4. Sécurité — contrôle d'accès (IDOR / autorisation)

| Date | Symptôme / risque | Cause racine | Correctif | Commit |
|---|---|---|---|---|
| 2026-07-05 | N'importe quel franchiseur pouvait modifier l'alerte d'un autre en devinant son UUID | Aucune vérification de propriété sur `validate`/`ignore` d'alerte | Vérification de propriété ajoutée | fc11937 |
| 2026-07-05 | Idem sur la mise à jour de section DIP | Pas de vérification de propriété du DIP avant `PUT /:id/sections/:sectionId` | Vérification ajoutée | fc11937 |
| 2026-07-06 | IDOR sur les clauses de contrat, le champ `previous_contract_id`, fuite de données sur les sections DIP via la route de proposition avocat | Vérifications de propriété/périmètre manquantes à plusieurs endroits | Vérifications ajoutées, filtre `dip_id` sur le fetch de section | 7326103 |
| 2026-07-06 | Détournement de compte possible via le callback OAuth (intégrations Drive/OneDrive) | Le paramètre `state` OAuth n'était pas signé — falsifiable (CSRF) | Signature HMAC-SHA256 du `state` | 7326103 |
| 2026-07-18 | **Critique** — n'importe quel contenu de section pouvait être lu via `POST /alerts/analyze` sans vérifier la propriété du DIP | Vérification de propriété absente avant chargement du contenu | Ajoutée | 1a9eff8 |
| 2026-07-18 | Un avocat (lecture seule) pouvait écrire via l'import Excel | `import-xlsx` n'excluait pas le rôle avocat | Blocage explicite | 1a9eff8 |
| 2026-07-18 | Fuite de données sur les attestations publiques | Le JSON public exposait `deliveries` (noms/emails de tous les franchisés) et `changes_snapshot` en clair | Liste blanche de champs publics | 1a9eff8 |
| 2026-07-30 | Un avocat avec accès API direct (contournant le frontend) pouvait écrire directement dans `dip_sections`, sans validation du franchiseur | Policy RLS `avocat_writes_sections` (`FOR ALL`) jamais versionnée, ajoutée à la main sur le Dashboard Supabase, jamais utilisée par aucun code applicatif | Policy supprimée — le seul chemin d'écriture avocat reste la table de proposition + validation explicite du franchiseur | 64a8119 |

## 5. Sécurité — base de données (RLS, grants, indexes)

| Date | Constat | Correctif | Commit |
|---|---|---|---|
| 2026-07-04, 2026-07-23, 2026-07-30 | `notify_lead_email()` exécutable publiquement — révoqué **trois fois**, revenu à chaque fois car un `CREATE OR REPLACE FUNCTION` réinitialise les grants à `PUBLIC` par défaut | Révocation réappliquée + documentée comme point à revérifier après toute modification de cette fonction | c865690, 3e8356d, 0c18478 |
| 2026-07-04 | `password_reset_tokens` sans RLS activé du tout | RLS activé (intentionnellement sans policy — accès service role uniquement) | c865690 |
| 2026-07-04, 2026-07-23, 2026-08-04, 2026-08-07 | Index manquants sur des clés étrangères, signalés par l'advisor perf à répétition | Ajoutés par vagues successives à mesure que de nouvelles tables apparaissaient | c865690, 3e8356d, 040, 041 |
| 2026-07-23 | `handle_new_user()` (SECURITY DEFINER) sans `search_path` fixé — risque d'injection de schéma | `search_path` figé sur `public` | 3e8356d |
| 2026-07-30 | 3 tables avec deux policies permissives identiques actives en même temps (une versionnée, une créée à la main sur le Dashboard, jamais synchronisée) | Doublons supprimés | 64a8119 |
| 2026-08-04, 2026-08-07 | Consolidation `dip_documents`/`dip_sections` : la policy `FOR ALL` (propriétaire) et la policy `FOR SELECT` (propriétaire OU avocat) étaient toutes deux évaluées à chaque lecture | Policy `FOR ALL` scindée en policies d'écriture uniquement ; la lecture reste couverte par la seule policy combinée | 040 |
| 2026-08-07 | Un index que je venais d'ajouter (040) faisait doublon avec un index existant depuis la migration 015, sous un nom différent — je n'avais pas vérifié avant d'en créer un nouveau | Doublon supprimé | 041 — **retenir : toujours vérifier les index existants sur une colonne avant d'en ajouter un** |

## 6. Messages d'erreur masqués / UX de diagnostic

| Date | Symptôme | Cause racine | Correctif | Commit |
|---|---|---|---|---|
| 2026-07-20 | Le lien d'invitation avocat affichait "Accès refusé." sans aucun contexte utile | L'intercepteur axios réécrivait **tout** 403 en "Accès refusé." et tout 404 en "Ressource introuvable.", écrasant le vrai message backend | Ne plus jamais réécrire ces messages | 9fcb314 |
| 2026-07-20 | "Analyse impossible — réessayez" sur l'analyse des risques de litige, alors que le serveur travaillait encore | Timeout client (30s) inférieur au budget serveur réel (300s sur Vercel) pour un appel Opus avec réflexion étendue | Timeout client relevé à 120s, erreurs réseau vs timeout distinguées | 91f98f5 |
| 2026-07-20 | Téléchargements PDF/DOCX/XLSX échouant avec un message générique | Les réponses d'erreur arrivent en `Blob` binaire pour les téléchargements — jamais parsées | Parsing du blob d'erreur avant affichage | 10b29ee |
| 2026-07-20 | 4 boutons "Enregistrer" indépendants de Réglages se désactivaient tous ensemble | Les 4 sections partageaient la même instance `useMutation` | Scindé en 4 mutations indépendantes | 10b29ee |

## 7. Exactitude juridique du moteur de conformité IA

| Date | Constat | Correctif | Commit |
|---|---|---|---|
| 2026-07-17 | **Critique** — le flux "Générer un DIP avec l'IA" (page la plus visible du produit) tournait sur un système de prompts secondaire et nettement plus faible (`dipAgent.js`) que celui utilisé pour l'analyse d'un DIP uploadé (`claude.js`) — grille légale absente, parsing JSON fragile, pas de retry | Migration complète vers `claude.js`, suppression de `dipAgent.js` | cc81a41 |
| 2026-07-17 | `POST /agent/formulate-field` (widget "Rédiger avec l'IA") appelé par le frontend mais jamais implémenté côté backend — 404 silencieux | Implémenté | cc81a41 |
| 2026-07-17 | Date du décret n°91-337 citée comme "1er avril 1991" au lieu du 4 avril 1991, sur le site public | Corrigé partout (llms.txt, blog) | cc81a41 |
| 2026-07-25 | La grille de conformité affirmait qu'une section légalement bloquante "expose à la nullité d'ordre public... l'absence suffit" — surestime l'automaticité (la nullité exige un vice du consentement démontré, pas la seule absence) | Reformulation conditionnelle partout où ce risque était sur-affirmé | 2c82f39 |
| 2026-07-25 | Citations légales obsolètes (décret seul, sans le codifiant R.330-1), mapping incorrect section↔article sur plusieurs sections | Toutes les références corrigées et vérifiées contre Légifrance/jurisprudence | 90c71cf |
| 2026-07-25 | R.330-1 3° (domiciliation bancaire) sans aucune vérification dans la grille — vrai trou, pas juste une citation | Ajouté comme élément obligatoire | 90c71cf |
| 2026-08-06 | État du marché **local** (R.330-1 4°), concurrent autorisé dans la zone, durée de licence de marque, clause de non-concurrence, résultats des sites pilotes : vérifiés par l'IA mais **aucun champ** du formulaire de génération ne permettait de les renseigner | Champs ajoutés au formulaire, grilles enrichies | 589a6c8 |

## 8. Certificats de mise à jour & notifications franchisés

| Date | Symptôme | Cause racine | Correctif | Commit |
|---|---|---|---|---|
| 2026-08-08 | "Les certifications de modification ne marchent toujours pas", "les notifications non plus" | `POST /certificates` (seul point de création d'une attestation) n'était appelé que par le flux de **réimport de fichier** — jamais par l'édition directe d'une section (page Mon DIP) ni par l'acceptation d'une proposition d'avocat. La notification aux franchisés partant de la même tâche de fond que la génération de certificat, elle ne se déclenchait jamais non plus pour ces deux chemins | Logique extraite en fonction réutilisable `createCertificate()`, appelée aussi depuis `PUT /dip/:id/sections/:sectionId` et `PUT /avocat/proposals/:id/accept` | 45b2d26 |
| 2026-08-08 | Un texte `[À COMPLÉTER : ...]` généré par l'IA pouvait être enregistré tel quel sans aucune alerte | Rien ne vérifiait la présence de ce marqueur après sauvegarde | Détection automatique (`config/incompleteContentCheck.js`) + alerte haute urgence à la sauvegarde, sur sections DIP et clauses de contrat | 45b2d26 |

## 9. Responsive mobile

| Date | Constat | Correctif | Commit |
|---|---|---|---|
| 2026-07-14 | Menu mobile sans bouton de fermeture, superposition z-index avec la barre de navigation basse | Corrigé | ad0cf4f |
| 2026-07-14 | Bannière IA du dashboard illisible sur mobile (un mot par ligne) | Empilement vertical sous `sm:` | 181ef6a |
| 2026-07-21, 2026-07-22 | Audit complet 375px : onglets qui débordent, grilles à 2/3 colonnes sans repli mobile, iframe de réservation coupée, bandes blanches au rebond de défilement (`background-attachment:fixed` sans fond sur `<html>`) | Corrections point par point | ec15f25, 85c8b0f |

---

## Checklist de sécurité & de maintenance permanente

À vérifier périodiquement (et systématiquement après toute modification touchant l'authentification, les policies RLS, ou les emails/liens générés) :

- [ ] `get_advisors` (sécurité + perf) ne montre aucune régression par rapport au dernier rapport
- [ ] Toute nouvelle migration écrite est **appliquée** (via `apply_migration` ou SQL fourni à l'utilisateur) et **vérifiée** — pas seulement committée
- [ ] Toute fonction `SECURITY DEFINER` a un `search_path` figé
- [ ] Toute policy RLS nouvellement ajoutée à la main sur le Dashboard Supabase est **reportée dans une migration versionnée** dans la journée — sinon elle finit par diverger silencieusement de ce qui est dans le repo (motif de 3 incidents distincts, voir §5)
- [ ] Toute route qui modifie une ressource (`PUT`/`POST`/`DELETE`) vérifie la propriété de la ressource avant d'agir — pas seulement l'authentification
- [ ] Tout lien généré côté backend (email, partage, invitation) passe par `getAppUrl()` — jamais un `process.env.APP_URL` direct
- [ ] Tout nouveau composant de route frontend passe par le wrapper `S()` (Suspense + ErrorBoundary) — jamais un `<Suspense>` nu
- [ ] `Leaked Password Protection` reste activée dans Supabase Auth (à revérifier manuellement — pas pilotable par migration)
- [ ] Les messages d'erreur backend réels remontent jusqu'à l'utilisateur — ne jamais réécrire `err.message` par un texte générique dans un `catch`
