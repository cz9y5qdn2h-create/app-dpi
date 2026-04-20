require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('FATAL: SUPABASE_URL manquant. Ajoutez-la dans vos variables d\'environnement.');
  process.exit(1);
}
if (!supabaseServiceKey) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY manquant. Le backend ne peut pas contourner les RLS sans cette clé.');
  process.exit(1);
}

// Client admin (contourne RLS) — usage backend uniquement, jamais exposé au client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Client avec le JWT de l'utilisateur (respecte les RLS)
const createUserClient = (accessToken) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: 'Bearer ' + accessToken } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

module.exports = { supabaseAdmin, createUserClient };
