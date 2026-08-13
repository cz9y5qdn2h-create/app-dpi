# INVARIANTS — ce qu'il ne faut jamais casser

Règles structurantes de DIPpro. Chacune existe parce que sa violation a
**déjà** produit un incident en production. Avant toute modification touchant
une de ces zones, relire la règle concernée.

Voir aussi : [BUG_JOURNAL.md](BUG_JOURNAL.md) (incidents détaillés),
[LEGAL_COPY.md](LEGAL_COPY.md) (libellés juridiques), [CHANGELOG.md](CHANGELOG.md).

---

## 1. Juridique — formulations interdites

| Interdit | Pourquoi | À écrire à la place |
|---|---|---|
| « entraîne la nullité », « rend le DIP invalide », « contrat nul » | La nullité n'est **jamais** automatique en droit français (Cass. com., 20 mars 2007, n°06-11.290) | « expose à un risque de nullité si le franchisé démontre que le manquement a vicié son consentement » |
| Présenter Cass. com. 26 juin 2024 comme confirmant une nullité pour DIP incomplet | L'arrêt porte sur la **dissimulation d'un fait postérieur à la remise**, sur un DIP par ailleurs conforme | « l'obligation d'information court jusqu'à la signature » |
| « DIP certifié conforme » | « Certifié » est réservé à l'horodatage SHA-256 (fait technique vérifiable), jamais au jugement IA | « attestation de remise horodatée (empreinte SHA-256) » |
| Citer « R.330-1 » seul | Un avocat doit pouvoir relier chaque statut au texte exact | « Art. R.330-1, 5° c) C. com. » |

**Trois endroits doivent rester synchronisés** sur le référentiel légal :
`backend/src/config/claude.js` (prompts du moteur), `frontend/src/lib/legalLibrary.js`
(bibliothèque avocat), `docs/LEGAL_COPY.md` (revue avocat). Modifier l'un sans
les autres crée une divergence entre ce que l'outil applique et ce qu'il affiche.

---

## 2. Base de données

- **Une migration écrite n'est pas une migration appliquée.** La 022 a vécu des
  mois dans le dépôt sans être en production → 11 h d'échecs d'écriture
  silencieux. Après toute migration, vérifier `/api/health` → `database_schema`.
- **Toute nouvelle colonne dont le code dépend** doit être ajoutée à
  `backend/src/config/schemaCheck.js`, sinon la dérive redevient invisible.
- **Vérifier les index existants** avant d'en créer un (un doublon a déjà été
  créé sous un autre nom).
- **Les valeurs de `status` sont contraintes par CHECK** : `dip_certificates.status`
  n'accepte que `pending | generated | ready | error`. Écrire une valeur hors
  liste fait échouer l'`UPDATE` **silencieusement** (le client Supabase ne lève
  pas) — les certificats restaient bloqués en « pending » pour toujours.
- **Numérotation des attestations** : jamais de `MAX(numero)+1`. Le trigger
  `assign_certificate_number` utilise un compteur atomique — un `MAX+1` sous
  insertions concurrentes attribue deux fois le même numéro ou crée un trou,
  ce qui détruit la valeur probatoire de la série.

---

## 3. Rôles et accès

- **`req.user` ne contient jamais `role`** — seulement `{ id, email, user_metadata }`.
  Tester `req.user.role` compare à `undefined` et passe toujours. Toujours relire
  le rôle en base (voir `middleware/avocatScope.js`).
- **Un cache de rôle qui refuse ne doit jamais bloquer sans revérification.**
  Un rôle corrigé en base laissait sinon l'utilisateur verrouillé 5 minutes.
- **Un admin ne peut pas changer son propre rôle** depuis la console : basculer
  son compte principal en `avocat` fait disparaître toutes ses données de la vue
  et lui retire l'accès admin — vécu comme une perte de données.
- **Le profil frontend doit se replier sur `/auth/me`** (service role,
  autoritaire) si la lecture directe RLS échoue, sinon l'interface diverge de
  ce que le backend autorise réellement.
- **Pour tester un rôle, utiliser un compte séparé** (`theo+avocat@…`), jamais
  le compte principal.

---

## 4. Certificats — chemins à couvrir

Toute route qui **modifie le contenu** d'un DIP ou d'un contrat doit appeler
`createCertificate` (non bloquant, en `.catch`). Chemins couverts aujourd'hui :

- `PUT /dip/:id/sections/:sectionId` — édition de section
- `PUT /contracts/:id/clauses/:clauseId` — édition de clause (via `linked_dip_id`)
- `PATCH /alerts/:id/validate` — validation d'une correction IA
- `PUT /avocat/proposals/:id/accept` et `/clause-proposals/:id/accept`
- `POST /dip/create-from-agent` — attestation INITIALE
- `POST /certificates` — flux de réimport (déclenché par le frontend)

**Ajouter un nouveau chemin de modification sans certificat = trou dans la
chaîne de preuve.**

---

## 5. Extraction de documents

- **Ne jamais revenir à `pdf-parse`** : ses quatre moteurs pdf.js (2017-2018)
  échouent tous en « bad XRef entry » sous Node 22, y compris sur des PDF
  valides. Utiliser `backend/src/config/textExtract.js` (pdfjs-dist v4).
- **Après toute montée de version Node** (locale ou Vercel), retester un upload
  PDF réel — c'est la dépendance la plus fragile du projet.

---

## 6. DNS du domaine de production

`iralink-agency.dippro.business` est servi par un **CNAME** vers Vercel. La norme DNS
interdit qu'un CNAME coexiste avec **tout autre enregistrement du même nom**.

- **Ne jamais ajouter de TXT, A, MX ou autre sur le nom `iralink-agency`.** Le 10/08/2026,
  un TXT de vérification Google posé à cet endroit a écrasé le CNAME et **mis le site
  entièrement hors ligne** (résolution DNS en échec, HTTP 000).
- **Vérification Google Search Console** : utiliser la **balise HTML** dans `index.html`
  (`<meta name="google-site-verification">`), jamais la méthode par enregistrement DNS.
- Enregistrement correct : `CNAME iralink-agency → d0e3e4d5e9f7f4a2.vercel-dns-017.com.`
- Domaine de secours toujours valide en cas de panne DNS : `app-dpi.vercel.app`.

---

## 7. URLs générées

- **Toujours passer par `getAppUrl()`** (`backend/src/config/appUrl.js`), qui
  filtre les hostnames `*.vercel.app`. Une URL en dur a déjà envoyé des liens
  d'attestation vers `dippro.fr`, un domaine qui n'est pas celui de
  l'application — un juge suivant le lien imprimé n'aurait rien trouvé.

---

## 8. Frontend

- **Pas de déplacement au survol** (`translateY`/`translateX`) sur les cartes,
  lignes et boutons : le reflet supérieur et l'ombre glissent hors du cadre,
  donnant l'impression que le contenu « sort » de sa case. Retour visuel par
  la bordure et l'ombre uniquement.
- **`<ErrorBoundary>` sur toutes les routes**, y compris publiques — assuré par
  le wrapper `S()` dans `App.jsx`. Ne pas contourner `S()`.
- **Les gardes de route doivent attendre `loading`** avant de décider d'une
  redirection, sinon la page s'affiche brièvement et une action peut partir
  avant la redirection (403 confus côté backend).
- **Aucun `console.log`** en production (règle projet, vérifiée à chaque passe).

---

## 9. Conformité affichée

- **Ne jamais afficher `compliance_level` / `conformity_score` stockés** : ils
  sont nuls pour les DIP générés par IA et périmés après toute édition
  manuelle. Recalculer en direct depuis les statuts des sections
  (`computeLiveCompliance` dans `backend/src/routes/compliance.js`).
- **Le score doit toujours être accompagné du disclaimer** (`SCORE_DISCLAIMER`
  dans `frontend/src/lib/legalCopy.js`).
