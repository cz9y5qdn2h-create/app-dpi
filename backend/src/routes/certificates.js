const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { generateChangesCertificate } = require('../config/claude');
const errMsg = require('../config/errorMessage');
const router = express.Router();

// POST /api/certificates — génère et persiste un certificat
router.post('/', authMiddleware, requireFranchisor, async (req, res) => {
  const { dip_id, certificate_type, changes = [], deliveries = [] } = req.body;

  if (!dip_id)            return res.status(400).json({ error: 'dip_id requis' });
  if (!certificate_type)  return res.status(400).json({ error: 'certificate_type requis (INITIAL|MISE_A_JOUR|REMISE)' });

  try {
    const { data: dip, error: dipErr } = await supabaseAdmin
      .from('dip_documents')
      .select('id, title, sha256, compliance_level, conformity_score, created_at')
      .eq('id', dip_id)
      .eq('user_id', req.user.id)
      .single();

    if (dipErr || !dip) return res.status(404).json({ error: 'DIP introuvable' });

    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('company_name, rcs, address')
      .eq('id', req.user.id)
      .single();

    const franchiseur = {
      nom:   userRow?.company_name || req.user.email,
      rcs:   userRow?.rcs          || 'Non renseigné',
      siege: userRow?.address      || 'Non renseigné'
    };

    const cert = await generateChangesCertificate({
      dipVersion: {
        version:          dip.id,
        created_at:       dip.created_at,
        sha256:           dip.sha256,
        compliance_level: dip.compliance_level || 'Non évalué',
        global_score:     dip.conformity_score  || 0
      },
      changes,
      franchiseur,
      deliveries,
      certificateType: certificate_type
    });

    const { data: saved, error: saveErr } = await supabaseAdmin
      .from('dip_certificates')
      .insert({
        dip_id,
        user_id:           req.user.id,
        certificate_type,
        certificate_title: cert.certificate_title,
        certificate_text:  cert.certificate_text,
        legal_summary:     cert.legal_summary,
        warnings:          cert.warnings          || [],
        sha256_dip:        dip.sha256             || null,
        compliance_level:  dip.compliance_level   || null,
        global_score:      dip.conformity_score   || null,
        changes_count:     changes.length,
        changes_snapshot:  changes,
        deliveries,
        generated_at:      cert.generated_at      || new Date().toISOString()
      })
      .select()
      .single();

    if (saveErr) throw new Error(saveErr.message);

    res.status(201).json({ certificate: saved });
  } catch (err) {
    console.error('Certificate generate error:', err.message);
    res.status(500).json({ error: errMsg(err) });
  }
});

// GET /api/certificates — liste des certificats de l'utilisateur
router.get('/', authMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const { data, error } = await supabaseAdmin
    .from('dip_certificates')
    .select('id, dip_id, certificate_type, certificate_title, legal_summary, warnings, compliance_level, global_score, changes_count, generated_at')
    .eq('user_id', req.user.id)
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: errMsg(error) });
  res.json({ certificates: data || [] });
});

// GET /api/certificates/:id — détail complet d'un certificat
router.get('/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('dip_certificates')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Certificat introuvable' });
  res.json({ certificate: data });
});

module.exports = router;
