const { supabaseAdmin } = require('../config/supabase');

// Résout l'identité "propriétaire des données" pour une requête donnée : un
// franchiseur agit toujours pour lui-même. Un avocat doit préciser quel
// client il consulte (franchiseur_id en query ou en param de route) et n'y
// accède qu'avec une relation avocat_franchiseurs active — même pattern que
// resolveDipOwner/resolveContractOwner dans avocat.js, généralisé aux routes
// qui ne portent pas sur un DIP/contrat précis (certificats, documents,
// veille réglementaire).
async function resolveScopedUserId(req) {
  if (req.user.role !== 'avocat') return req.user.id;

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
