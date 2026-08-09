const { supabaseAdmin } = require('../config/supabase');

// Résout l'identité "propriétaire des données" pour une requête donnée : un
// franchiseur agit toujours pour lui-même. Un avocat doit préciser quel
// client il consulte (franchiseur_id en query ou en param de route) et n'y
// accède qu'avec une relation avocat_franchiseurs active — même pattern que
// resolveDipOwner/resolveContractOwner dans avocat.js, généralisé aux routes
// qui ne portent pas sur un DIP/contrat précis (certificats, documents,
// veille réglementaire).
//
// Le rôle est relu en base : authMiddleware ne place que { id, email,
// user_metadata } dans req.user, jamais le rôle. Le tester sur req.user
// revenait à le comparer à undefined — la branche avocat n'était donc
// jamais empruntée et l'avocat recevait ses propres données (vides) au lieu
// de celles de son client.
async function resolveScopedUserId(req) {
  const { data: profile } = await supabaseAdmin
    .from('users').select('role').eq('id', req.user.id).maybeSingle();

  if (profile?.role !== 'avocat') return req.user.id;

  const franchiseurId = req.query.franchiseur_id || req.params.franchiseurId;
  if (!franchiseurId) return null;

  const { data: relation } = await supabaseAdmin
    .from('avocat_franchiseurs')
    .select('status')
    .eq('avocat_id', req.user.id)
    .eq('franchiseur_id', franchiseurId)
    .maybeSingle();

  return relation?.status === 'active' ? franchiseurId : null;
}

module.exports = { resolveScopedUserId };
