const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { generateChangesCertificate } = require('../config/claude');
const { generateCertificatePDF } = require('../config/certificatePdf');
const errMsg = require('../config/errorMessage');
const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

const fetchFranchiseur = async (userId, fallbackEmail) => {
  const { data } = await supabaseAdmin
    .from('users')
    .select('company_name, rcs, address, phone')
    .eq('id', userId)
    .single();
  return {
    nom:       data?.company_name || fallbackEmail,
    rcs:       data?.rcs          || 'Non renseigné',
    adresse:   data?.address      || 'Non renseigné',
    telephone: data?.phone        || 'Non renseigné',
  };
};

const uploadPdfToStorage = async (pdfBuffer, certId, certType, publicToken) => {
  const path = `${certId}/attestation-${certType.toLowerCase()}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from('dip-certificates')
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage
    .from('dip-certificates')
    .getPublicUrl(path);
  return data.publicUrl;
};

const sendPdfFromBuffer = (res, pdfBuffer, cert) => {
  const filename = `attestation-dip-${cert.certificate_type.toLowerCase()}-${cert.id.split('-')[0]}.pdf`;
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `inline; filename="${filename}"`,
    'Content-Length':      pdfBuffer.length,
    'Cache-Control':       'public, max-age=86400',
  });
  res.send(pdfBuffer);
};

// ─── POST /api/certificates — génère et persiste ─────────────────────────────
router.post('/', authMiddleware, requireFranchisor, async (req, res) => {
  const { dip_id, certificate_type, changes = [], deliveries = [] } = req.body;

  if (!dip_id)           return res.status(400).json({ error: 'dip_id requis' });
  if (!certificate_type) return res.status(400).json({ error: 'certificate_type requis (INITIAL|MISE_A_JOUR|REMISE)' });

  try {
    const { data: dip, error: dipErr } = await supabaseAdmin
      .from('dip_documents')
      .select('id, title, sha256, compliance_level, conformity_score, created_at')
      .eq('id', dip_id)
      .eq('user_id', req.user.id)
      .single();

    if (dipErr || !dip) return res.status(404).json({ error: 'DIP introuvable' });

    const franchiseur = await fetchFranchiseur(req.user.id, req.user.email);

    const cert = await generateChangesCertificate({
      dipVersion: {
        version:          dip.id,
        created_at:       dip.created_at,
        sha256:           dip.sha256,
        compliance_level: dip.compliance_level || 'Non évalué',
        global_score:     dip.conformity_score || 0,
      },
      changes,
      franchiseur,
      deliveries,
      certificateType: certificate_type,
    });

    const publicToken = uuidv4();

    const { data: saved, error: saveErr } = await supabaseAdmin
      .from('dip_certificates')
      .insert({
        dip_id,
        user_id:           req.user.id,
        certificate_type,
        certificate_title: cert.certificate_title,
        certificate_text:  cert.certificate_text,
        legal_summary:     cert.legal_summary,
        warnings:          cert.warnings         || [],
        sha256_dip:        dip.sha256            || null,
        compliance_level:  dip.compliance_level  || null,
        global_score:      dip.conformity_score  || null,
        changes_count:     changes.length,
        changes_snapshot:  changes,
        deliveries,
        generated_at:      cert.generated_at     || new Date().toISOString(),
        public_token:      publicToken,
      })
      .select()
      .single();

    if (saveErr) throw new Error(saveErr.message);

    // Génère le PDF une fois et le stocke — évite la regénération à chaque accès
    let pdfUrl = null;
    try {
      const pdfBuffer = await generateCertificatePDF(saved, franchiseur);
      pdfUrl = await uploadPdfToStorage(pdfBuffer, saved.id, certificate_type, publicToken);

      await supabaseAdmin
        .from('dip_certificates')
        .update({ pdf_url: pdfUrl })
        .eq('id', saved.id);

      saved.pdf_url = pdfUrl;
    } catch (pdfErr) {
      console.error('PDF storage error (non-bloquant):', pdfErr.message);
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://dippro.fr';
    res.status(201).json({
      certificate:  saved,
      public_url:   `${baseUrl}/attestation/${publicToken}`,
      pdf_url:      pdfUrl,
    });
  } catch (err) {
    console.error('Certificate generate error:', err.message);
    res.status(500).json({ error: errMsg(err) });
  }
});

// ─── GET /api/certificates — liste ───────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const { data, error } = await supabaseAdmin
    .from('dip_certificates')
    .select('id, dip_id, certificate_type, certificate_title, legal_summary, warnings, compliance_level, global_score, changes_count, generated_at, public_token, pdf_url')
    .eq('user_id', req.user.id)
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: errMsg(error) });

  const baseUrl = process.env.FRONTEND_URL || 'https://dippro.fr';
  const certs = (data || []).map(c => ({
    ...c,
    public_url: c.public_token ? `${baseUrl}/attestation/${c.public_token}` : null,
  }));
  res.json({ certificates: certs });
});

// ─── GET /api/certificates/:id — détail (authentifié) ────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('dip_certificates')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Certificat introuvable' });

  const baseUrl = process.env.FRONTEND_URL || 'https://dippro.fr';
  res.json({
    certificate: data,
    public_url:  data.public_token ? `${baseUrl}/attestation/${data.public_token}` : null,
    pdf_url:     data.pdf_url || null,
  });
});

// ─── GET /api/certificates/:id/pdf — PDF (authentifié) ───────────────────────
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('dip_certificates')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Certificat introuvable' });

  // Redirect vers le PDF stocké si disponible (servi par CDN Supabase)
  if (data.pdf_url) return res.redirect(302, data.pdf_url);

  // Fallback : génère à la volée si le PDF n'est pas encore en storage
  try {
    const franchiseur = await fetchFranchiseur(data.user_id, '');
    const pdfBuffer   = await generateCertificatePDF(data, franchiseur);

    // Tente de stocker pour les prochains accès
    try {
      const url = await uploadPdfToStorage(pdfBuffer, data.id, data.certificate_type, data.public_token);
      await supabaseAdmin.from('dip_certificates').update({ pdf_url: url }).eq('id', data.id);
    } catch { /* silencieux */ }

    sendPdfFromBuffer(res, pdfBuffer, data);
  } catch (err) {
    console.error('PDF generation error:', err.message);
    res.status(500).json({ error: errMsg(err) });
  }
});

// ─── GET /api/certificates/public/:token — accès public sans auth ─────────────
router.get('/public/:token', async (req, res) => {
  const token = req.params.token;
  if (!token || token.length > 64) return res.status(400).json({ error: 'Token invalide' });

  const { data, error } = await supabaseAdmin
    .from('dip_certificates')
    .select('*')
    .eq('public_token', token)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Attestation introuvable ou lien invalide' });

  if (req.query.format === 'json') {
    return res.json({ certificate: data });
  }

  // Redirect vers le PDF stocké si disponible (CDN, aucune CPU serveur)
  if (data.pdf_url) return res.redirect(302, data.pdf_url);

  // Fallback : génère à la volée et stocke pour les prochains accès
  try {
    const franchiseur = await fetchFranchiseur(data.user_id, '');
    const pdfBuffer   = await generateCertificatePDF(data, franchiseur);

    try {
      const url = await uploadPdfToStorage(pdfBuffer, data.id, data.certificate_type, data.public_token);
      await supabaseAdmin.from('dip_certificates').update({ pdf_url: url }).eq('id', data.id);
    } catch { /* silencieux */ }

    sendPdfFromBuffer(res, pdfBuffer, data);
  } catch (err) {
    console.error('Public PDF error:', err.message);
    res.status(500).json({ error: 'Erreur de génération du PDF' });
  }
});

module.exports = router;
