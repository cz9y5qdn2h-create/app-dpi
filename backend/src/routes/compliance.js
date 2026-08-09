const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { resolveScopedUserId } = require('../middleware/avocatScope');
const router = express.Router();

const LEGAL_DELAY_DAYS = 20;

function computeSignatureDelay(dip_delivered_at, planned_signature_date) {
  if (!dip_delivered_at || !planned_signature_date) return null;
  const daysBetween = Math.round((new Date(planned_signature_date) - new Date(dip_delivered_at)) / 86400000);
  return { days_between: daysBetween, compliant: daysBetween >= LEGAL_DELAY_DAYS };
}

// GET /api/compliance/overview — un seul endroit qui rassemble tous les
// signaux de conformité DIP, quelle que soit leur origine (contenu
// incomplet, délai légal de 20 jours, risques de litige, veille
// réglementaire, candidats en reprise nécessitant des pièces
// supplémentaires) — franchiseur pour ses propres données, avocat pour un
// client sélectionné via ?franchiseur_id=.
router.get('/overview', authMiddleware, async (req, res) => {
  const scopedUserId = await resolveScopedUserId(req);
  if (!scopedUserId) return res.status(403).json({ error: 'Accès refusé' });

  const [
    { data: dips },
    { data: contracts },
    { data: alerts },
    { data: franchisees },
  ] = await Promise.all([
    supabaseAdmin.from('dip_documents').select('id, title, compliance_level, conformity_score, blocking_issues').eq('user_id', scopedUserId).eq('status', 'actif').limit(1),
    supabaseAdmin.from('franchise_contracts').select('id, title, compliance_level, conformity_score').eq('user_id', scopedUserId).eq('status', 'actif').limit(1),
    supabaseAdmin.from('alerts').select('id, type, title, source, suggestion, urgency, created_at, dip_id, franchisee_id').eq('user_id', scopedUserId).eq('status', 'pending').order('created_at', { ascending: false }),
    supabaseAdmin.from('franchisees').select('id, name, status, candidate_type, dip_delivered_at, planned_signature_date').eq('franchiseur_id', scopedUserId),
  ]);

  const dip = dips?.[0] || null;
  const contract = contracts?.[0] || null;
  const allAlerts = alerts || [];

  const signatureDelays = (franchisees || [])
    .filter(f => f.status === 'en_cours')
    .map(f => ({ ...f, signature_delay: computeSignatureDelay(f.dip_delivered_at, f.planned_signature_date) }))
    .filter(f => f.signature_delay);

  const reprises = (franchisees || []).filter(f => f.candidate_type === 'reprise' && f.status === 'en_cours');

  const { data: regulatoryNews } = await supabaseAdmin
    .from('regulatory_news_cache')
    .select('id, title, url, source, impact_level, impact_reason, published_at')
    .in('impact_level', ['high', 'critical'])
    .order('published_at', { ascending: false })
    .limit(5);

  res.json({
    dip,
    contract,
    alerts: {
      total: allAlerts.length,
      haute: allAlerts.filter(a => a.urgency === 'haute').length,
      moyenne: allAlerts.filter(a => a.urgency === 'moyenne').length,
      faible: allAlerts.filter(a => a.urgency === 'faible').length,
      items: allAlerts.slice(0, 10),
    },
    signature_delays: {
      count: signatureDelays.filter(f => !f.signature_delay.compliant).length,
      items: signatureDelays,
    },
    reprises: {
      count: reprises.length,
      items: reprises,
    },
    regulatory_news: regulatoryNews || [],
  });
});

module.exports = router;
