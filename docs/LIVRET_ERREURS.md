# DIPpro — Livret des Erreurs

> Référence complète des erreurs connues, leurs causes et leurs solutions  
> Iralink Agency · Dernière mise à jour : 15 juin 2026

---

## Comment utiliser ce livret

1. Identifie la **catégorie** de l'erreur (Frontend / Backend / Supabase / Vercel / IA)
2. Cherche le **message d'erreur** ou le **symptôme**
3. Applique la **solution** correspondante
4. Si le problème persiste → consulte la section **Diagnostic avancé**

---

## CATÉGORIE 1 — Erreurs d'authentification

---

### ERR-AUTH-001 — "Session expirée, reconnectez-vous"
**Quand** : L'utilisateur est redirigé vers `/login` de façon inattendue  
**Cause** : Le `access_token` JWT a expiré (durée par défaut : 1 heure dans Supabase)  
**Solution** :
- Vérifier que le refresh token est bien configuré dans `AuthContext.jsx`
- S'assurer que `autoRefreshToken: true` est dans la config `lib/supabase.js`
- Si ça arrive trop souvent : augmenter la durée de session dans Supabase → Auth → Settings → JWT expiry

---

### ERR-AUTH-002 — "Multiple GoTrueClient instances detected"
**Quand** : Warning dans la console du navigateur  
**Cause** : `createClient()` appelé plus d'une fois dans le frontend  
**Solution** :
```bash
grep -r "createClient" frontend/src/
```
Il ne doit y avoir QU'UNE seule occurrence dans `frontend/src/lib/supabase.js`.  
Si d'autres fichiers appellent `createClient`, les remplacer par :
```js
import { supabase } from '../lib/supabase';
```

---

### ERR-AUTH-003 — "Erreur de configuration. Contactez l'administrateur"
**Quand** : À la connexion, message d'erreur immédiat  
**Cause** : Variable `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` manquante/incorrecte  
**Solution** :
1. Vérifier dans Vercel → Settings → Environment Variables
2. Les variables `VITE_*` sont injectées au **build** → redéployer après modification
3. Vérifier aussi que l'URL Supabase est bien `https://xlfycuhmbnzeofgnleof.supabase.co`

---

### ERR-AUTH-004 — "Invalid login credentials"
**Quand** : À la connexion  
**Cause** : Email ou mot de passe incorrect — ou compte non confirmé  
**Solution** :
- Vérifier l'email dans Supabase → Authentication → Users
- Vérifier que `email_confirm` = true (ou désactiver la confirmation email dans les settings)
- Réinitialiser le mot de passe depuis la console Admin DIPpro

---

### ERR-AUTH-005 — Connexion impossible après inscription
**Quand** : L'utilisateur vient de créer un compte mais ne peut pas se connecter  
**Cause** : La table `users` n'a pas de profil créé (trigger `on_new_user` absent ou en échec)  
**Solution** :
1. Vérifier dans Supabase → Table Editor → `users` si le profil existe
2. Si absent : vérifier que le trigger `handle_new_user` est bien actif dans Database → Functions
3. Appliquer la migration `step3_trigger_admin.sql` si nécessaire

---

## CATÉGORIE 2 — Erreurs Frontend React

---

### ERR-FRONT-001 — Page blanche sans message d'erreur
**Quand** : L'application ne s'affiche pas du tout  
**Cause** : Erreur JavaScript non capturée avant le montage de l'ErrorBoundary  
**Solution** :
1. Ouvrir les DevTools → Console → chercher l'erreur rouge
2. Vérifier que `import './i18n'` est bien dans `main.jsx` (erreur de chargement i18n = page blanche)
3. Vérifier que les variables d'env `VITE_*` sont définies

---

### ERR-FRONT-002 — "t is not a function" / clé de traduction affichée telle quelle
**Quand** : Le texte affiché est `auth.login.title` au lieu de "Connexion"  
**Cause** : `import './i18n'` manquant dans `main.jsx` ou fichier JSON invalide  
**Solution** :
1. Vérifier `main.jsx` : `import './i18n';` doit être avant les imports de composants
2. Valider les JSON : `cat frontend/src/i18n/locales/fr.json | python3 -m json.tool`
3. Vérifier que la clé existe dans les deux fichiers `fr.json` et `en.json`

---

### ERR-FRONT-003 — "Le serveur est inaccessible. Vérifiez votre connexion"
**Quand** : Toutes les requêtes API échouent  
**Cause** : Variable `VITE_API_URL` manquante ou backend down  
**Solution** :
1. Vérifier `VITE_API_URL` dans Vercel (doit pointer vers l'URL de l'API backend)
2. Tester l'API directement : `curl https://votre-api.vercel.app/api/health`
3. Vérifier les logs de la fonction serverless dans Vercel → Functions

---

### ERR-FRONT-004 — Thème ne se charge pas / styles manquants
**Quand** : L'interface est sans style ou avec des couleurs incorrectes  
**Cause** : `data-theme` absent sur `document.documentElement`  
**Solution** :
1. Vérifier dans `ThemeContext.jsx` que `document.documentElement.setAttribute('data-theme', theme)` est bien appelé
2. Vérifier que la valeur dans `localStorage('dippro-theme')` est l'un de : `glass`, `nuit`, `azur`, `nacre`, `emeraude`
3. Vider le localStorage et recharger : `localStorage.clear()` dans la console DevTools

---

### ERR-FRONT-005 — Composant crashe avec "Cannot read properties of null"
**Quand** : Une page crashe au chargement  
**Cause** : Données API nulles non gérées (race condition ou premier chargement)  
**Solution** :
1. Ajouter du optional chaining : `data?.property` au lieu de `data.property`
2. Vérifier que l'ErrorBoundary dans `App.jsx` entoure bien la route affectée
3. Utiliser `isLoading` de React Query pour afficher un skeleton en attendant

---

## CATÉGORIE 3 — Erreurs Backend Express

---

### ERR-BACK-001 — "FATAL: SUPABASE_SERVICE_ROLE_KEY manquant"
**Quand** : Crash du backend au démarrage  
**Cause** : Variable d'environnement non définie  
**Solution** :
1. Ajouter `SUPABASE_SERVICE_ROLE_KEY` dans Vercel → Settings → Environment Variables
2. La clé se trouve dans Supabase → Settings → API → "service_role" (⚠️ jamais committer)
3. Redéployer après ajout

---

### ERR-BACK-002 — Timeout 504 sur l'analyse IA
**Quand** : L'upload et l'analyse d'un DIP échouent après ~60 secondes  
**Cause** : Vercel Functions ont un timeout de 60s (plan hobby) ou 300s (plan pro)  
**Solution** :
- Vérifier que `maxDuration: 60` est dans `vercel.json` pour la fonction API
- Réduire la taille du DIP uploadé (éviter les PDF avec images haute résolution)
- Si récurrent sur Pro : implémenter l'analyse en tâche de fond (pattern déjà en place sur `/certificates`)

---

### ERR-BACK-003 — "Rate limit exceeded" sur l'analytics
**Quand** : Les events de lecture DIP ne sont pas enregistrés  
**Cause** : Route `POST /api/analytics/read` limitée à 40 req/min par `visit_id`  
**Solution** :
- Comportement normal si un utilisateur ouvre/ferme rapidement de nombreuses sections
- Si c'est problématique, ajuster le rate limit dans `routes/analytics.js`

---

### ERR-BACK-004 — Email Brevo non envoyé
**Quand** : Les franchisés ne reçoivent pas les notifications  
**Cause** : `BREVO_API_KEY` manquante ou invalide  
**Solution** :
1. Vérifier la clé dans Vercel → Environment Variables
2. Tester la clé sur le dashboard Brevo → API Keys
3. Vérifier que `BREVO_SENDER_EMAIL` est un domaine vérifié dans Brevo
4. Consulter les logs d'envoi dans Brevo → Logs → Transactional

---

### ERR-BACK-005 — "403 Forbidden" sur toutes les routes auth
**Quand** : Toutes les requêtes authentifiées retournent 403  
**Cause** : Middleware `requireAuth` ne valide pas le JWT correctement  
**Solution** :
1. Vérifier que `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont corrects
2. Vérifier que le `access_token` en localStorage est bien transmis dans le header `Authorization`
3. Decoder le JWT sur jwt.io pour vérifier qu'il n'est pas expiré

---

## CATÉGORIE 4 — Erreurs Supabase

---

### ERR-SUPA-001 — "new row violates row-level security policy"
**Quand** : Une insertion ou mise à jour échoue en base de données  
**Cause** : RLS bloque l'opération car le contexte auth ne correspond pas à la politique  
**Solution** :
- Le backend utilise `supabaseAdmin` qui contourne le RLS → si cette erreur arrive côté backend, vérifier qu'on utilise bien `supabaseAdmin` et pas un client anon
- Côté frontend (Supabase JS direct) : vérifier que l'utilisateur est bien connecté avant l'opération
- Vérifier la politique dans Supabase → Authentication → Policies

---

### ERR-SUPA-002 — "relation does not exist"
**Quand** : Requête SQL échoue sur une table absente  
**Cause** : Migration non appliquée  
**Solution** :
1. Vérifier les migrations dans `supabase/migrations/`
2. Appliquer via Supabase MCP ou SQL Editor dans le dashboard
3. Table `dip_reads` ? → appliquer `create_dip_reads_analytics`

---

### ERR-SUPA-003 — Performance lente sur les requêtes avec RLS
**Quand** : Les requêtes sur des tables volumineuses sont lentes  
**Cause** : `auth.uid()` réévalué à chaque ligne dans les politiques RLS  
**Solution** : Remplacer dans les politiques SQL :
```sql
-- ❌ Lent (réévaluation par ligne)
USING (user_id = auth.uid())

-- ✅ Rapide (évalué une seule fois)
USING (user_id = (SELECT auth.uid()))
```

---

### ERR-SUPA-004 — Fichier non accessible dans Storage
**Quand** : URL de fichier retourne 403 ou fichier introuvable  
**Cause** : Le bucket `dip-certificates` est privé — accès via URL signée uniquement  
**Solution** :
- Les URLs CDN publiques ne fonctionnent PAS pour les buckets privés
- Utiliser le backend (supabaseAdmin) pour générer une URL signée :
```js
const { data } = await supabaseAdmin.storage
  .from('dip-certificates')
  .createSignedUrl(path, 3600); // 1 heure
```

---

### ERR-SUPA-005 — Trigger admin ne se déclenche pas
**Quand** : Un nouvel utilisateur n'a pas de profil dans la table `users`  
**Cause** : Le trigger `on_auth_user_created` est absent ou désactivé  
**Solution** :
1. Vérifier dans Supabase → Database → Functions → `handle_new_user`
2. Vérifier dans Database → Triggers → `on_auth_user_created`
3. Si absent, appliquer la migration `005_auth_trigger.sql`

---

## CATÉGORIE 5 — Erreurs IA (Claude)

---

### ERR-IA-001 — "ANTHROPIC_API_KEY manquant" ou analyse qui ne démarre pas
**Quand** : L'upload réussit mais l'analyse IA ne se lance pas  
**Cause** : Clé API Anthropic manquante dans l'environnement  
**Solution** :
1. Ajouter `ANTHROPIC_API_KEY=sk-ant-...` dans Vercel → Environment Variables
2. Redéployer après ajout
3. Vérifier que la clé est active sur console.anthropic.com

---

### ERR-IA-002 — Analyse retourne des sections vides ou mal détectées
**Quand** : Le score de conformité est 0 ou les sections sont toutes "Non conforme"  
**Cause** : Le PDF ne contient pas de texte extractible (scan d'image) ou est trop corrompu  
**Solution** :
1. Vérifier que le PDF est sélectionnable (pas un scan)
2. Tester l'extraction : `pdf-parse` doit retourner du texte non vide
3. Conseiller l'utilisateur de faire un PDF natif depuis Word (Fichier → Exporter → PDF)
4. Alternative : uploader en format DOCX directement

---

### ERR-IA-003 — Timeout ou "overloaded_error" depuis Anthropic
**Quand** : L'analyse échoue après 30-60 secondes avec une erreur Anthropic  
**Cause** : L'API Anthropic est surchargée ou le document est trop volumineux  
**Solution** :
1. Implémenter un retry avec backoff exponentiel (2s, 4s, 8s)
2. Réduire la taille du document avant upload (comprimer le PDF)
3. Vérifier le statut de l'API sur status.anthropic.com

---

### ERR-IA-004 — Prompt caching non actif (coûts plus élevés que prévu)
**Quand** : Les coûts d'API Anthropic sont anormalement élevés  
**Cause** : Le `cache_control: { type: "ephemeral" }` n'est pas appliqué sur le system prompt  
**Solution** :
1. Vérifier dans `backend/src/config/claude.js` que `SYSTEM_DIP_EXPERT` a bien `cache_control`
2. Le cache s'active seulement si le prompt dépasse ~1024 tokens
3. Vérifier les headers de réponse Anthropic : `cache_read_input_tokens` doit être > 0

---

## CATÉGORIE 6 — Erreurs Vercel / Déploiement

---

### ERR-VERCEL-001 — Build échoue "Cannot find module"
**Quand** : Le déploiement Vercel échoue pendant le build  
**Cause** : Dépendance manquante ou import incorrect  
**Solution** :
1. Lancer `cd frontend && npm run build` en local → identifier l'erreur exacte
2. Vérifier que la dépendance est dans `frontend/package.json` (pas seulement en global)
3. Vérifier les chemins d'import (case-sensitive en Linux mais pas macOS)

---

### ERR-VERCEL-002 — API retourne 500 en production mais fonctionne en local
**Quand** : Les appels API échouent uniquement en production  
**Cause** : Variable d'environnement manquante en production Vercel  
**Solution** :
1. Comparer les variables locales `.env` avec celles de Vercel → Settings → Environment Variables
2. Vérifier que les variables sont définies pour l'environnement "Production" (pas seulement "Preview")
3. Consulter Vercel → Functions → Logs pour voir l'erreur exacte

---

### ERR-VERCEL-003 — Timeout 504 répété
**Quand** : Les analyses IA dépassent systématiquement le timeout  
**Cause** : Vercel Functions Hobby = 60s max  
**Solution** :
1. Passer au plan Pro Vercel (timeout jusqu'à 300s)
2. Ou implémenter le pattern async : retourner 202 immédiatement + traiter en background
3. Réduire la taille des documents analysés

---

### ERR-VERCEL-004 — CORS error en production
**Quand** : Requêtes API bloquées par le navigateur avec "CORS policy"  
**Cause** : `FRONTEND_URL` incorrect dans les variables backend Vercel  
**Solution** :
1. Vérifier `FRONTEND_URL` dans Vercel → pointe-t-il vers la bonne URL frontend ?
2. Vérifier la config CORS dans `backend/src/server.js`
3. Si domaine personnalisé ajouté récemment, mettre à jour `FRONTEND_URL`

---

## CATÉGORIE 7 — Erreurs spécifiques aux fonctionnalités

---

### ERR-FUNC-001 — Lien de partage DIP invalide
**Quand** : Un franchisé clique sur le lien et reçoit "Document introuvable"  
**Cause** : Le `share_token` a été révoqué ou le DIP a été supprimé  
**Solution** :
1. Vérifier dans Supabase → `dip_documents` → colonne `share_token`
2. Si révoqué (`share_token = null`) : régénérer depuis DIPPage → Partager
3. Si le DIP existe mais le lien ne fonctionne pas : vérifier la route publique `/shared/:token`

---

### ERR-FUNC-002 — Analytics de lecture non enregistrées
**Quand** : La page Analytics affiche 0 visites alors que des franchisés ont consulté  
**Cause** : `navigator.sendBeacon` bloqué ou `dip_reads` table absente  
**Solution** :
1. Vérifier que la table `dip_reads` existe dans Supabase
2. Tester manuellement : ouvrir le lien de partage, attendre 2s, fermer → l'event doit s'enregistrer
3. Vérifier que `POST /api/analytics/read` retourne 204 (pas d'erreur CORS)
4. Certains bloqueurs de pub bloquent `sendBeacon` → normal, ne peut pas être évité

---

### ERR-FUNC-003 — Export DOCX/PDF vide ou corrompu
**Quand** : Le fichier téléchargé est vide ou s'ouvre en erreur  
**Cause** : Données DIP manquantes ou erreur dans la génération du document  
**Solution** :
1. Vérifier que le DIP a des sections analysées (score > 0)
2. Consulter les logs backend pour la route `/api/export`
3. Tester l'export JSON d'abord pour vérifier que les données sont bien présentes

---

### ERR-FUNC-004 — Notification franchisés non envoyée
**Quand** : Le bouton "Notifier" ne produit aucun email  
**Cause** : Brevo API key invalide ou email sender non vérifié  
**Solution** :
1. Tester la clé Brevo sur le dashboard : brevo.com → Transactional → Test
2. Vérifier que l'adresse `BREVO_SENDER_EMAIL` est vérifiée dans Brevo → Senders
3. Vérifier les logs dans Vercel → Functions pour voir l'erreur retournée par Brevo

---

### ERR-FUNC-005 — Score de conformité toujours à 0%
**Quand** : Après analyse, le score affiché est 0 ou indéfini  
**Cause** : L'analyse IA n'a pas pu extraire les sections du document  
**Solution** :
1. Vérifier que le PDF contient du texte sélectionnable (pas un scan)
2. Consulter les logs backend — la réponse de Claude doit contenir des sections JSON
3. Vérifier le format de réponse attendu dans `parseDIPSections()` dans `claude.js`

---

## Diagnostic avancé

### Vérifier les logs en production
```bash
# Vercel CLI
vercel logs --prod

# Ou dans le dashboard
# Vercel → votre projet → Functions → cliquer sur une fonction → Logs
```

### Requêtes SQL utiles pour déboguer

```sql
-- Vérifier les derniers utilisateurs créés
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10;

-- Vérifier les DIPs récents
SELECT id, user_id, name, score, created_at FROM dip_documents ORDER BY created_at DESC LIMIT 10;

-- Vérifier les lectures analytics récentes
SELECT * FROM dip_reads ORDER BY created_at DESC LIMIT 20;

-- Compter les alertes par statut
SELECT status, count(*) FROM alerts GROUP BY status;

-- Vérifier les politiques RLS actives
SELECT tablename, policyname, cmd, qual FROM pg_policies ORDER BY tablename;
```

### Variables d'env à vérifier en priorité
```
SUPABASE_SERVICE_ROLE_KEY  → Backend uniquement, jamais dans le frontend
ANTHROPIC_API_KEY          → Doit commencer par sk-ant-
VITE_SUPABASE_URL          → Baked au build — redéployer si changée
BREVO_API_KEY              → Doit commencer par xkeysib-
FRONTEND_URL               → Doit correspondre exactement au domaine frontend
```

---

## Contact support

**Développeur** : Théo · theo@iralink-agency.com  
**Données personnelles** : privacy@iralink-agency.com  
**Supabase Dashboard** : https://supabase.com/dashboard/project/xlfycuhmbnzeofgnleof  
**Vercel Dashboard** : https://vercel.com/dashboard  
**Anthropic Console** : https://console.anthropic.com  
**Brevo Dashboard** : https://app.brevo.com  

---

*Généré par Claude Code · Iralink Agency · 15 juin 2026*
