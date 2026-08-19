# CHANGELOG — DIPpro

Journal des modifications, du plus récent au plus ancien. Chaque entrée relie
le **symptôme observé** à la **cause racine** et au **garde-fou** posé, pour
qu'une session future puisse refaire le lien sans relire tout le code.

Conventions : 🔴 correctif bloquant · 🟡 correctif · 🟢 fonctionnalité · 🔵 documentation
Voir aussi : [INVARIANTS.md](INVARIANTS.md) · [BUG_JOURNAL.md](BUG_JOURNAL.md) · [LEGAL_COPY.md](LEGAL_COPY.md)

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
