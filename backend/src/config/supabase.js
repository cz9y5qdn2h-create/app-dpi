require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('ERREUR: SUPABASE_URL manquant');
}
if (!supabaseServiceKey) {
  console.error('ERREUR: SUPABASE_SERVICE_ROLE_KEY manquant');
}

// Client admin (contourne RLS) - usage backend uniquement
const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || supabaseAnonKey || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Creer un client avec le JWT de l'utilisateur
const createUserClient = (accessToken) => {
  return createClient(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
      global: { headers: { Authorization: 'Bearer ' + accessToken } },
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );
};

module.exports = { supabaseAdmin, createUserClient };
