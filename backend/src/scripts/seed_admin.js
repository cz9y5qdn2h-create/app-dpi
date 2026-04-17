/**
 * Script de seed: crée le compte administrateur principal
 * Usage: node src/scripts/seed_admin.js
 * Ce compte est le seul à pouvoir gérer les utilisateurs de la plateforme.
 */
require('dotenv').config({ path: '../../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'theo@iralink-agency.com';
  const password = process.env.ADMIN_PASSWORD || '*Theo.iralink-agency';

  console.log(`Vérification du compte admin: ${email}`);

  const { data: existing } = await supabase
    .from('users').select('id, role').eq('email', email).single();

  if (existing) {
    // S'assurer que le rôle est bien 'admin'
    if (existing.role !== 'admin') {
      await supabase.from('users').update({ role: 'admin', is_active: true }).eq('id', existing.id);
      console.log('✓ Rôle mis à jour: admin');
    } else {
      console.log('✓ Compte admin déjà configuré correctement.');
    }
    return;
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError) {
    console.error('Erreur création auth:', authError.message);
    return;
  }

  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    email,
    role: 'admin',
    company_name: 'Iralink Agency',
    is_active: true,
    created_at: new Date().toISOString()
  });

  if (profileError) {
    console.error('Erreur création profil:', profileError.message);
    return;
  }

  console.log('✓ Compte administrateur créé avec succès');
  console.log(`  Email: ${email}`);
  console.log(`  UUID: ${authData.user.id}`);
  console.log(`  Rôle: admin`);
}

seedAdmin().catch(console.error);
