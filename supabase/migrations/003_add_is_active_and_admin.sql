-- Migration 003: Champ is_active + rôle admin (Loi Doubin - contrôle d'accès)
-- Seul l'administrateur (theo@iralink-agency.com) peut activer/désactiver des comptes.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.is_active IS 'Compte actif ou suspendu — géré uniquement par l''administrateur';

CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- S'assurer que le compte admin a le bon rôle
UPDATE public.users
  SET role = 'admin', is_active = true
  WHERE email = 'theo@iralink-agency.com';
