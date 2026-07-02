const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { detectChanges, correctSection, correctSectionWithAnswers } = require('../config/claude');
const errMsg = require('../config/errorMessage');
const router = express.Router();

// GET /api/alerts — Alertes de l'utilisateur connecté (DIP + Contrat, y compris impacts croisés)
router.get('/', authMiddleware, async (req, res) => {
  const { status, dip_id, contract_id } = req.query;

  // Récupérer les IDs des documents de l'utilisateur (filtre sécurisé)
  const [{ data: userDips }, { data: userContracts }] = await Promise.all([
    supabaseAdmin.from('dip_documents').select('id').eq('user_id', req.user.id),
    supabaseAdmin.from('franchise_contracts').select('id').eq('user_id', req.user.id)
  ]);

  const dipIds = (userDips || []).map(d => d.id);
  const contractIds = (userContracts || []).map(c => c.id);

  if (dipIds.length === 0 && contractIds.length === 0) {
    return res.json({ alerts: [], total: 0 });
  }

  let query = supabaseAdmin
    .from('alerts')
    .select('*, dip_sections(section_title, section_number), contract_clauses(clause_title, clause_number)')
    .order('created_at', { ascending: false });

  const orFilters = [];
  if (dipIds.length > 0) orFilters.push(`dip_id.in.(${dipIds.join(',')})`);
  if (contractIds.length > 0) orFilters.push(`contract_id.in.(${contractIds.join(',')})`);
  query = query.or(orFilters.join(','));

  if (dip_id) query = query.eq('dip_id', dip_id);
  if (contract_id) query = query.eq('contract_id', contract_id);
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

// PATCH /api/alerts/:id/validate — Valider une alerte (met à jour la section DIP ou la clause du contrat)
router.patch('/:id/validate', authMiddleware, requireFranchisor, async (req, res) => {
  const { modified_content } = req.body;

  const { data: alert } = await supabaseAdmin
    .from('alerts')
    .select('*, dip_sections(*), contract_clauses(*)')
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

  if (alert.clause_id && newContent) {
    await supabaseAdmin
      .from('contract_clauses')
      .update({ content: newContent, status: 'conforme', last_updated: new Date().toISOString() })
      .eq('id', alert.clause_id);
  }

  await supabaseAdmin
    .from('alerts')
    .update({ status: 'validated', resolved_at: new Date().toISOString() })
    .eq('id', req.params.id);

  await supabaseAdmin.from('audit_log').insert({
    dip_id: alert.dip_id,
    section_id: alert.section_id,
    contract_id: alert.contract_id,
    clause_id: alert.clause_id,
    action: 'alert_validated',
    old_content: alert.old_value,
    new_content: newContent,
    user_id: req.user.id,
    timestamp: new Date().toISOString()
  });

  res.json({ message: 'Alerte validée, document mis à jour' });
});

// POST /api/alerts/check-renewal — Génère un rappel de renouvellement DIP
// Le seuil est configurable via users.renewal_alert_days (défaut 30 j avant l'anniversaire annuel)
router.post('/check-renewal', authMiddleware, requireFranchisor, async (req, res) => {
  const { data: userProfile } = await supabaseAdmin
    .from('users')
    .select('renewal_alert_days')
    .eq('id', req.user.id)
    .single();

  const alertDays = userProfile?.renewal_alert_days ?? 30;
  const thresholdMs = (365 - alertDays) * 24 * 3600 * 1000;

  const { data: dips } = await supabaseAdmin
    .from('dip_documents')
    .select('id, title, created_at')
    .eq('user_id', req.user.id)
    .eq('status', 'actif');

  if (!dips || dips.length === 0) return res.json({ alerts_created: 0 });

  const now = Date.now();
  const created = [];

  for (const dip of dips) {
    const age = now - new Date(dip.created_at).getTime();
    if (age >= thresholdMs) {
      const { data: existing } = await supabaseAdmin
        .from('alerts')
        .select('id')
        .eq('dip_id', dip.id)
        .eq('status', 'pending')
        .like('source', '%Rappel renouvellement%')
        .limit(1);

      if (!existing || existing.length === 0) {
        const daysLeft = Math.max(0, Math.round((365 * 24 * 3600 * 1000 - age) / (24 * 3600 * 1000)));
        const { data: alert } = await supabaseAdmin.from('alerts').insert({
          dip_id: dip.id,
          old_value: `DIP approchant de sa date de renouvellement annuel`,
          new_value: 'Mise à jour annuelle requise (Loi Doubin)',
          source: 'Rappel renouvellement annuel',
          suggestion: `La mise à jour annuelle du DIP est requise dans ${daysLeft} jour(s). Importez la nouvelle version pour rester conforme à la Loi Doubin (art. L.330-3).`,
          status: 'pending',
          urgency: daysLeft <= 7 ? 'haute' : 'moyenne',
          created_at: new Date().toISOString()
        }).select().single();
        if (alert) created.push(alert);
      }
    }
  }

  res.json({ alerts_created: created.length, alerts: created, threshold_days: alertDays });
});

// POST /api/alerts/ai-corrections/:dipId — Génère des corrections IA pour les sections non conformes
router.post('/ai-corrections/:dipId', authMiddleware, requireFranchisor, async (req, res) => {
  const { dipId } = req.params;

  // Vérifier que le DIP appartient à l'utilisateur
  const { data: dip, error: dipError } = await supabaseAdmin
    .from('dip_documents')
    .select('id, title')
    .eq('id', dipId)
    .eq('user_id', req.user.id)
    .single();

  if (dipError || !dip) return res.status(404).json({ error: 'DIP introuvable' });

  // Charger les sections non conformes ou à vérifier
  const { data: sections, error: sectError } = await supabaseAdmin
    .from('dip_sections')
    .select('*')
    .eq('dip_id', dipId)
    .in('status', ['non_conforme', 'a_verifier'])
    .order('section_number');

  if (sectError) return res.status(500).json({ error: sectError.message });
  if (!sections || sections.length === 0) {
    return res.json({ alerts_created: 0, message: 'Toutes les sections sont déjà conformes.' });
  }

  // Supprimer les anciennes corrections IA en attente pour ce DIP (éviter les doublons)
  await supabaseAdmin
    .from('alerts')
    .delete()
    .eq('dip_id', dipId)
    .eq('source', 'Correction IA')
    .eq('status', 'pending');

  const createdAlerts = [];
  const errors = [];

  // Traitement par batches de 3 — 3× plus rapide que séquentiel
  const BATCH = 3;
  for (let i = 0; i < sections.length; i += BATCH) {
    const batch = sections.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(section =>
      correctSection({
        section_number: section.section_number,
        section_title: section.section_title,
        content: section.content,
        issues: section.issues || [],
        status: section.status
      }).then(correction => ({ section, correction }))
    ));

    for (const result of results) {
    try {
      if (result.status === 'rejected') throw result.reason;
      const { section, correction } = result.value;
      const urgency = section.status === 'non_conforme' ? 'haute' : 'moyenne';

      const alertData = correction.needs_info
        ? {
            dip_id: dipId,
            section_id: section.id,
            old_value: section.content || '(Section vide)',
            source: 'Correction IA',
            status: 'pending',
            urgency,
            needs_info: true,
            questions: correction.questions || [],
            created_at: new Date().toISOString()
          }
        : {
            dip_id: dipId,
            section_id: section.id,
            old_value: section.content || '(Section vide)',
            new_value: correction.corrected_content,
            source: 'Correction IA',
            suggestion: correction.corrected_content,
            status: 'pending',
            urgency,
            needs_info: false,
            corrections_made: JSON.stringify(correction.corrections_made || []),
            remaining_issues: JSON.stringify(correction.remaining_issues || []),
            ai_confidence: correction.confidence || 'moyenne',
            created_at: new Date().toISOString()
          };

      const { data: alert, error: alertErr } = await supabaseAdmin
        .from('alerts')
        .insert(alertData)
        .select()
        .single();

      if (alertErr) errors.push({ error: alertErr.message });
      else createdAlerts.push(alert);
    } catch (err) {
      errors.push({ error: err.message });
    }
    } // fin for results
  } // fin for batches

  res.json({
    alerts_created: createdAlerts.length,
    sections_analyzed: sections.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `${createdAlerts.length} correction(s) IA générée(s) sur ${sections.length} section(s) analysée(s).`
  });
});

// POST /api/alerts/:id/answer-questions — Franchiseur répond aux questions de l'IA, génère la correction
router.post('/:id/answer-questions', authMiddleware, requireFranchisor, async (req, res) => {
  const { answers } = req.body;
  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers (tableau) requis' });
  }

  const { data: alert } = await supabaseAdmin
    .from('alerts')
    .select('*, dip_sections(*)')
    .eq('id', req.params.id)
    .single();

  if (!alert) return res.status(404).json({ error: 'Alerte introuvable' });
  if (!alert.needs_info) return res.status(400).json({ error: 'Cette alerte n\'attend pas de réponses' });

  const { data: userDip } = await supabaseAdmin
    .from('dip_documents')
    .select('id')
    .eq('id', alert.dip_id)
    .eq('user_id', req.user.id)
    .single();

  if (!userDip) return res.status(403).json({ error: 'Accès refusé' });

  try {
    const questions = Array.isArray(alert.questions) ? alert.questions : [];
    const questionsAndAnswers = questions.map((q, i) => ({
      question: q,
      answer: answers[i] || ''
    }));

    const correction = await correctSectionWithAnswers(
      alert.dip_sections || { section_number: '?', section_title: 'Section', content: alert.old_value, status: 'non_conforme' },
      questionsAndAnswers
    );

    await supabaseAdmin
      .from('alerts')
      .update({
        needs_info: false,
        answers: answers,
        suggestion: correction.corrected_content,
        new_value: correction.corrected_content,
        corrections_made: JSON.stringify(correction.corrections_made || []),
        remaining_issues: JSON.stringify(correction.remaining_issues || []),
        ai_confidence: correction.confidence || 'moyenne'
      })
      .eq('id', req.params.id);

    res.json({ message: 'Correction générée avec succès', alert_id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/:id/ignore — Ignorer une alerte
router.patch('/:id/ignore', authMiddleware, requireFranchisor, async (req, res) => {
  const { reason } = req.body;

  const { data: alert } = await supabaseAdmin
    .from('alerts').select('dip_id, contract_id').eq('id', req.params.id).single();

  await supabaseAdmin
    .from('alerts')
    .update({
      status: 'ignored',
      resolved_at: new Date().toISOString(),
      ignore_reason: reason || 'Ignorée par le franchiseur'
    })
    .eq('id', req.params.id);

  await supabaseAdmin.from('audit_log').insert({
    dip_id: alert?.dip_id || req.body.dip_id || null,
    contract_id: alert?.contract_id || null,
    action: 'alert_ignored',
    user_id: req.user.id,
    new_content: reason || '',
    timestamp: new Date().toISOString()
  });

  res.json({ message: 'Alerte ignorée' });
});

module.exports = router;
