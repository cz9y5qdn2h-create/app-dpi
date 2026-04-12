-- ============================================================
-- Seed: Créer le compte admin beta
-- À exécuter via Supabase Dashboard > SQL Editor
-- OU via: supabase db reset --db-url ...
-- ============================================================

-- NOTE: La création du compte auth se fait via l'API Admin ou le Dashboard Supabase.
-- Ce seed crée uniquement le profil users une fois l'auth créé.

-- Après avoir créé l'utilisateur via Dashboard Supabase Auth:
-- Email: theo@iralink-agency.com
-- Password: *Theo.iralink-agency
-- Copier l'UUID généré et remplacer <USER_UUID> ci-dessous:

-- INSERT INTO public.users (id, email, role, company_name)
-- VALUES (
--   '<USER_UUID>',
--   'theo@iralink-agency.com',
--   'franchiseur',
--   'Iralink Agency'
-- );

-- OU via la fonction Edge (voir backend/src/scripts/seed_admin.js)
