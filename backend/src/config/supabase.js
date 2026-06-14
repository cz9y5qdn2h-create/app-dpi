require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('FATAL: SUPABASE_URL manquant. Ajoutez-la dans les variables d\'environnement Vercel.');
}
if (!supabaseServiceKey) {
  throw new Error('FATAL: SUPABASE_SERVICE_ROLE_KEY manquant. Ajoutez-la dans les variables d\'environnement Vercel.');
}

// Client admin (contourne RLS) — usage backend uniquement, jamais exposé au client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = { supabaseAdmin };
