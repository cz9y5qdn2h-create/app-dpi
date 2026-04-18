const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { detectChanges } = require('../config/claude');
const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const { status, dip_id } = req.query;
  let query = supabaseAdmin
    .from('alerts')
    .select('*, dip_documents(title, user_id), dip_sections(section_title, section_number)')
    .order('created_at', { ascending: false });
  if (dip_id) query = query.eq('dip_id', dip_id);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  const userAlerts = (data || []).filter(a => a.dip_documents?.user_id === req.user.id);
  res.json({ alerts: userAlerts, total: userAlerts.length });
});

router.post('/analyze', authMiddleware, requireFranchisor, async (req, res) => {
  const { dip_id, section_id, document_text, source_name } = req.body;
  if (!dip_id || !document_text) return res.status(400).json({ error: 'dip_id et document_text requis' });
  try {
    const { data: section } = await supabaseAdmin.from('dip_sections').select('*').eq('id', section_id).single();
    if (!section) return res.status(404).json({ error: 'Section introuvable' });
    const result = await detectChanges(section.content, document_text, section.section_title);
    if (result.has_changes && result.changes.length > 0) {
      const alertsToInsert = result.changes.map(change => ({
        dip_id, section_id,
        old_value: change.old_value, new_value: change.new_value,
        source: source_name || 'Document manuel',
        suggestion: change.suggestion, status: 'pending',
        urgency: result.urgency || 'moyenne',
        created_at: new Date().toISOString()
      }));
      const { data: newAlerts } = await supabaseAdmin.from('alerts').insert(alertsToInsert).select();
      return res.json({ has_changes: true, alerts: newAlerts });
    }
    res.json({ has_changes: false, alerts: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/validate', authMiddleware, requireFranchisor, async (req, res) => {
  const { modified_content } = req.body;
  const { data: alert } = await supabaseAdmin
    .from('alerts').select('*, dip_sections(*), dip_documents(user_id)').eq('id', req.params.id).single();
  if (!alert) return res.status(404).json({ error: 'Alerte introuvable' });
  if (alert.dip_documents?.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
  if (alert.status !== 'pending') return res.status(409).json({ error: 'Alerte déjà traitée', status: alert.status });

  const newContent = modified_content || alert.suggestion || alert.new_value;
  await Promise.all([
    supabaseAdmin.from('dip_sections').update({ content: newContent, status: 'conforme', last_updated: new Date().toISOString() }).eq('id', alert.section_id),
    supabaseAdmin.from('alerts').update({ status: 'validated', resolved_at: new Date().toISOString() }).eq('id', req.params.id)
  ]);
  await supabaseAdmin.from('audit_log').insert({
    dip_id: alert.dip_id, section_id: alert.section_id, action: 'alert_validated',
    old_content: alert.old_value, new_content: newContent,
    user_id: req.user.id, timestamp: new Date().toISOString()
  });
  const { data: allSections } = await supabaseAdmin.from('dip_sections').select('status').eq('dip_id', alert.dip_id);
  if (allSections?.length) {
    const score = Math.round((allSections.filter(s => s.status === 'conforme').length / allSections.length) * 100);
    await supabaseAdmin.from('dip_documents').update({ conformity_score: score }).eq('id', alert.dip_id);
  }
  res.json({ message: 'Alerte validée, section mise à jour' });
});

router.patch('/:id/ignore', authMiddleware, requireFranchisor, async (req, res) => {
  const { reason } = req.body;
  const { data: alert } = await supabaseAdmin.from('alerts').select('*, dip_documents(user_id)').eq('id', req.params.id).single();
  if (!alert) return res.status(404).json({ error: 'Alerte introuvable' });
  if (alert.dip_documents?.user_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
  if (alert.status !== 'pending') return res.status(409).json({ error: 'Alerte déjà traitée', status: alert.status });
  await supabaseAdmin.from('alerts').update({
    status: 'ignored', resolved_at: new Date().toISOString(),
    ignore_reason: (reason || '').trim() || 'Ignoré par le franchiseur'
  }).eq('id', req.params.id);
  res.json({ message: 'Alerte ignorée' });
});

module.exports = router;
