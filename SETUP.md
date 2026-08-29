# Guide d'installation DIPpro

## 1. Supabase - Base de donnees

### Creer le projet Supabase
1. Aller sur https://app.supabase.com/
2. Creer un nouveau projet
3. Recuperer dans Settings > API :
   - `Project URL` -> SUPABASE_URL
   - `anon / public key` -> SUPABASE_ANON_KEY
   - `service_role key` -> SUPABASE_SERVICE_ROLE_KEY

### Appliquer le schema
1. Ouvrir le SQL Editor dans Supabase
2. Copier-coller le contenu de `supabase/migrations/001_initial_schema.sql`
3. Executer

### Creer le bucket Storage
1. Storage > New Bucket : `dip-files` (Public)

### Creer le compte admin
1. Authentication > Users > Invite user
   - Email: `<votre email>`
   - Password: `<choisissez un mot de passe fort>`
2. Copier l'UUID genere
3. Executer dans SQL Editor :
```sql
INSERT INTO public.users (id, email, role, company_name)
VALUES ('<UUID_COPIE>', '<votre email>', 'franchiseur', '<votre société>');
```
OU utiliser le script seed :
```bash
cd backend && node src/scripts/seed_admin.js
```

## 2. Backend - Variables d'environnement

Creer `backend/.env` :
```
PORT=3001
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
RESEND_SENDER_EMAIL=contact@dippro.business
RESEND_SENDER_NAME=DIPpro
ADMIN_EMAIL=<votre email>
ADMIN_PASSWORD=<mot de passe fort — pas de valeur par défaut>
```

## 3. Frontend - Variables d'environnement

Creer `frontend/.env` :
```
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

## 4. Demarrage local

```bash
# Backend
cd backend
npm install
npm run dev
# API disponible sur http://localhost:3001

# Frontend (autre terminal)
cd frontend
npm install
npm run dev
# App disponible sur http://localhost:5173
```

## 5. Deploiement Vercel

### Backend
1. `cd backend && vercel --prod`
2. Ajouter toutes les variables d'env dans Vercel > Settings > Environment Variables

### Frontend
1. `cd frontend && vercel --prod`
2. Mettre a jour `VITE_API_URL` avec l'URL du backend Vercel
3. Mettre a jour `frontend/vercel.json` avec l'URL reelle du backend

## 6. Cles API necessaires

| Service | Ou l'obtenir | Usage |
|---------|-------------|-------|
| Supabase | app.supabase.com | DB + Auth + Storage |
| Anthropic | console.anthropic.com | IA Claude Sonnet |
| Resend (opt.) | resend.com/emails | Emails franchises |

## 7. Compte admin

Le seed n'installe aucun compte par défaut : `ADMIN_EMAIL` et `ADMIN_PASSWORD`
(définis à l'étape 2) sont les identifiants du compte créé, avec le rôle
franchiseur (admin).
