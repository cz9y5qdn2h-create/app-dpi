const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { detectChanges } = require('../config/claude');
const router = express.Router();

// GET /api/alerts — Alertes de l'utilisateur connecté
router.get('/', authMiddleware, async (req, res) => {
  const { status, dip_id } = req.query;

  // Récupérer les DIP IDs de l'utilisateur (filtre sécurisé)
  const { data: userDips } = await supabaseAdmin
    .from('dip_documents')
    .select('id')
    .eq('user_id', req.user.id);

  if (!userDips || userDips.length === 0) {
    return res.json({ alerts: [], total: 0 });
  }

  const dipIds = userDips.map(d => d.id);

  let query = supabaseAdmin
    .from('alerts')
    .select('*, dip_sections(section_title, section_number)')
    .in('dip_id', dipIds)
    .order('created_at', { ascending: false });

  if (dip_id) query = query.eq('dip_id', dip_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ alerts: data || [], total: data?.length || 0 });
});

// POST /api/alerts/analyze — Analyser un document source contre une section DIP
router.post('/analyze', authMiddleware, requireFranchisor, async (req, res) => {
  const { dip_id, section_id, document_text, source_name } = req.body;
  if (!dip_id || !document_text) {
    return res.status(400).json({ error: 'dip_id et document_text requis' });
  }

  try {
    const { data: section } = await supabaseAdmin
      .from('dip_sections')
      .select('*')
      .eq('id', section_id)
      .single();

    if (!section) return res.status(404).json({ error: 'Section introuvable' });

    const result = await detectChanges(section.content, document_text, section.section_title);

    if (result.has_changes && result.changes.length > 0) {
      const alertsToInsert = result.changes.map(change => ({
        dip_id,
        section_id,
        old_value: change.old_value,
        new_value: change.new_value,
        source: source_name || 'Document manuel',
        suggestion: change.suggestion,
        status: 'pending',
        urgency: result.urgency || 'moyenne',
        created_at: new Date().toISOString()
      }));

      const { data: newAlerts, error: insertError } = await supabaseAdmin
        .from('alerts')
        .insert(alertsToInsert)
        .select();

      if (insertError) throw new Error(insertError.message);
      return res.json({ has_changes: true, alerts: newAlerts });
    }

    res.json({ has_changes: false, alerts: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/:id/validate — Valider une alerte (met à jour la section DIP)
router.patch('/:id/validate', authMiddleware, requireFranchisor, async (req, res) => {
  const { modified_content } = req.body;

  const { data: alert } = await supabaseAdmin
    .from('alerts')
    .select('*, dip_sections(*)')
    .eq('id', req.params.id)
    .single();

  if (!alert) return res.status(404).json({ error: 'Alerte introuvable' });

  const newContent = modified_content || alert.suggestion || alert.new_value;

  if (alert.section_id && newContent) {
    await supabaseAdmin
      .from('dip_sections')
      .update({ content: newContent, status: 'conforme', last_updated: new Date().toISOString() })
      .eq('id', alert.section_id);
  }

  await supabaseAdmin
    .from('alerts')
    .update({ status: 'validated', resolved_at: new Date().toISOString() })
    .eq('id', req.params.id);

  await supabaseAdmin.from('audit_log').insert({
    dip_id: alert.dip_id,
    section_id: alert.section_id,
    action: 'alert_validated',
    old_content: alert.old_value,
    new_content: newContent,
    user_id: req.user.id,
    timestamp: new Date().toISOString()
  });

  res.json({ message: 'Alerte validée, section mise à jour' });
});

// PATCH /api/alerts/:id/ignore — Ignorer une alerte
router.patch('/:id/ignore', authMiddleware, requireFranchisor, async (req, res) => {
  const { reason } = req.body;

  await supabaseAdmin
    .from('alerts')
    .update({
      status: 'ignored',
      resolved_at: new Date().toISOString(),
      ignore_reason: reason || 'Ignorée par le franchiseur'
    })
    .eq('id', req.params.id);

  await supabaseAdmin.from('audit_log').insert({
    dip_id: req.body.dip_id,
    action: 'alert_ignored',
    user_id: req.user.id,
    new_content: reason || '',
    timestamp: new Date().toISOString()
  });

  res.json({ message: 'Alerte ignorée' });
});

module.exports = router;
