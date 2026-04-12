# Deploiement DIP Pilot

## Supabase (CONFIGURE)

- **Projet**: `nqboedyhlmyxyefjkshg`
- **URL**: `https://nqboedyhlmyxyefjkshg.supabase.co`
- **Region**: eu-west-1
- **Schema**: Applique (tables + RLS + bucket `dip-files`)
- **Compte admin**: `theo@iralink-agency.com` / `*Theo.iralink-agency`

Recuperer la `service_role key` dans Supabase > Settings > API > service_role

## Vercel - Frontend

1. Aller sur https://vercel.com/new
2. Importer le repo `cz9y5qdn2h-create/app-dpi`
3. **Root Directory**: `frontend`
4. **Framework**: Vite
5. Variables d'environnement :
   ```
   VITE_SUPABASE_URL = https://nqboedyhlmyxyefjkshg.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xYm9lZHlobG15eHllZmprc2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjM0ODEsImV4cCI6MjA5MDQ5OTQ4MX0.qp8IjE9-MRZFKviebneQU6rLP_PRp3ma673HBpTUDf4
   VITE_API_URL = <URL du backend Vercel apres deploiement>
   ```
6. Deploy

## Vercel - Backend

1. Aller sur https://vercel.com/new
2. Meme repo, **Root Directory**: `backend`
3. **Framework**: Other (Node.js)
4. Variables d'environnement :
   ```
   SUPABASE_URL = https://nqboedyhlmyxyefjkshg.supabase.co
   SUPABASE_ANON_KEY = eyJhbGci... (anon key)
   SUPABASE_SERVICE_ROLE_KEY = <service_role key depuis Supabase>
   ANTHROPIC_API_KEY = <votre cle Anthropic>
   FRONTEND_URL = <URL du frontend Vercel>
   BREVO_API_KEY = <optionnel>
   ```
5. Deploy

## Demarrage local rapide

```bash
# Cloner
git clone https://github.com/cz9y5qdn2h-create/app-dpi
git checkout claude/dip-pilot-beta-h9OuT

# Backend
cd backend
cp .env.example .env
# Remplir SUPABASE_SERVICE_ROLE_KEY et ANTHROPIC_API_KEY dans .env
npm install
npm run dev

# Frontend (nouvel onglet)
cd frontend
cp .env.example .env.local
npm install
npm run dev

# Acceder a l'app: http://localhost:5173
# Login admin: theo@iralink-agency.com / *Theo.iralink-agency
```

## Cles API a obtenir

| Cle | Ou | Obligatoire |
|-----|----|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API | Oui |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Oui (parsing DIP) |
| `BREVO_API_KEY` | app.brevo.com | Non (emails) |
