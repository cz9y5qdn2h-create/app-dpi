# DIPpro

SaaS de mise à jour automatique du Document d'Information Précontractuelle (DIP) pour franchiseurs français.

## Stack
- Frontend: React + Tailwind CSS (Vite)
- Backend: Node.js + Express
- DB: Supabase (PostgreSQL)
- Auth: Supabase Auth
- IA: Claude API (claude-sonnet-4-20250514)
- Email: Resend
- Deploy: Vercel

## Structure
```
app-dpi/
├── frontend/   # React app
└── backend/    # Express API
```

## Démarrage
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```
