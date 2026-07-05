const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { generateChangesCertificate } = require('../config/claude');
const { generateCertificatePDF } = require('../config/certificatePdf');
const errMsg = require('../config/errorMessage');
const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

const escapeHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fetchFranchiseur = async (userId, fallbackEmail) => {
  const { data } = await supabaseAdmin
    .from('users')
    .select('company_name, siret, siren, address, phone')
    .eq('id', userId)
    .single();
  return {
    nom:       data?.company_name || fallbackEmail,
    rcs:       data?.siret || data?.siren || 'Non renseigné',
    adresse:   data?.address      || 'Non renseigné',
    telephone: data?.phone        || 'Non renseigné',
  };
};

const uploadPdfToStorage = async (pdfBuffer, certId, certType, publicToken) => {
  const path = `${certId}/attestation-${certType.toLowerCase()}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from('dip-certificates')
    .upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('dip-certificates').getPublicUrl(path);
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

// ─── Email HTML template ──────────────────────────────────────────────────────

const buildDipUpdateEmail = (franchiseeName, companyName, summary, attestationUrl, changesCount) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F4F4">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F4;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#080808;border-radius:12px;overflow:hidden;border:1px solid #1E1E1E">
        <tr>
          <td style="background:#080808;border-bottom:2px solid #C8A96E;padding:24px 32px">
            <div style="font-family:sans-serif;font-size:20px;font-weight:700;color:#C8A96E">DIPpro</div>
            <div style="font-family:sans-serif;font-size:11px;color:#5A5A5A;margin-top:3px">${escapeHtml(companyName)} · Document d'Information Précontractuelle</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-family:sans-serif;color:#F4F2EE">
            <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#F4F2EE">Madame, Monsieur ${escapeHtml(franchiseeName)},</p>
            <p style="margin:0 0 20px;font-size:13px;color:#CBD5E1;line-height:1.7">
              Conformément à l'article <strong style="color:#C8A96E">L.330-3 du Code de commerce (Loi Doubin)</strong>
              et au Décret n° 91-337, votre franchiseur vous informe d'une mise à jour du Document d'Information
              Précontractuelle (DIP). Cette mise à jour comporte
              <strong style="color:#C8A96E">${changesCount} modification(s)</strong>.
            </p>
            <div style="background:#0F0F0F;border:1px solid #2A2A2A;border-radius:8px;padding:20px;margin:0 0 20px">
              <div style="font-size:10px;font-weight:700;color:#C8A96E;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px">Synthèse des modifications</div>
              <p style="font-size:12px;color:#94A3B8;line-height:1.7;margin:0;white-space:pre-wrap">${escapeHtml(summary)}</p>
            </div>
            <div style="background:#0A0A1A;border-left:3px solid #C8A96E;padding:14px 16px;margin:0 0 28px;border-radius:0 6px 6px 0">
              <p style="font-size:12px;color:#94A3B8;margin:0;line-height:1.6">
                <strong style="color:#C8A96E">⚠ Délai légal :</strong> Vous disposez d'un délai minimum de
                <strong style="color:#F4F2EE">20 jours</strong> avant toute signature de contrat ou avenant
                à compter de la réception de ce DIP mis à jour.
              </p>
            </div>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom:8px">
                  <a href="${escapeHtml(attestationUrl)}"
                     style="display:inline-block;background:#C8A96E;color:#080808;font-family:sans-serif;font-size:13px;font-weight:700;padding:14px 32px;text-decoration:none;border-radius:6px;letter-spacing:0.02em">
                    Consulter l'attestation de modification
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="font-size:10px;color:#3A3A3A">Ce lien est accessible sans authentification — conservez-le comme preuve de remise.</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #1A1A1A;font-family:sans-serif;font-size:10px;color:#3A3A3A;line-height:1.6">
            Ce document constitue une preuve de remise conforme au sens de l'art. L.330-3 C.com. &amp; Décret 91-337.<br>
            Attestation générée et certifiée par DIPpro by Iralink-Agency · ${new Date().getFullYear()}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ─── Notification automatique franchisés après mise à jour DIP ───────────────

async function notifyFranchisees({ userId, certId, dipId, publicToken, cert, pdfUrl, changes }) {
  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) return; // Brevo non configuré — silencieux

  const { data: franchisor } = await supabaseAdmin
    .from('users')
    .select('company_name, brevo_api_key, brevo_sender_name, brevo_sender_email')
    .eq('id', userId)
    .single();

  const apiKey      = franchisor?.brevo_api_key || brevoKey;
  const companyName = franchisor?.company_name  || 'Votre franchiseur';
  const senderName  = franchisor?.brevo_sender_name  || process.env.BREVO_SENDER_NAME  || 'DIPpro';
  const senderEmail = franchisor?.brevo_sender_email || process.env.BREVO_SENDER_EMAIL || 'noreply@dippro.fr';

  const { data: franchisees } = await supabaseAdmin
    .from('franchisees')
    .select('id, name, email')
    .eq('franchiseur_id', userId)
    .eq('status', 'actif');

  if (!franchisees?.length) return;

  const baseUrl      = process.env.FRONTEND_URL || 'https://dippro.fr';
  const attestationUrl = pdfUrl || `${baseUrl}/attestation/${publicToken}`;
  const summary      = cert.legal_summary || cert.certificate_text || '';
  const sentAt       = new Date().toISOString();
  const deliveries   = [];

  for (const f of franchisees) {
    if (!f.email) continue;
    let ok = false;
    try {
      const html = buildDipUpdateEmail(f.name, companyName, summary, attestationUrl, changes.length);
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: f.email, name: f.name }],
          subject: `[${companyName}] Mise à jour de votre DIP — ${changes.length} modification(s)`,
          htmlContent: html,
        }),
      });
      ok = response.ok;
    } catch { /* silencieux */ }

    deliveries.push({
      franchisee_id:   f.id,
      franchisee_name: f.name,
      email:           f.email,
      sent_at:         sentAt,
      ok,
    });
  }

  // Enregistrer dans notifications
  const notifRows = deliveries.filter(d => d.ok).map(d => ({
    franchisee_id: d.franchisee_id,
    dip_id:        dipId,
    message:       summary,
    sent_at:       sentAt,
    status:        'sent',
  }));
  if (notifRows.length > 0) {
    await supabaseAdmin.from('notifications').insert(notifRows).catch(() => {});
  }

  // Mettre à jour le champ deliveries du certificat
  await supabaseAdmin
    .from('dip_certificates')
    .update({ deliveries })
    .eq('id', certId)
    .catch(() => {});
}

// ─── POST /api/certificates — insère immédiatement (pending), génère en tâche de fond ──
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
    const publicToken = uuidv4();
    const generatedAt = new Date().toISOString();

    const { data: saved, error: saveErr } = await supabaseAdmin
      .from('dip_certificates')
      .insert({
        dip_id,
        user_id:           req.user.id,
        certificate_type,
        certificate_title: '',
        certificate_text:  '',
        legal_summary:     '',
        warnings:          [],
        sha256_dip:        dip.sha256           || null,
        compliance_level:  dip.compliance_level || null,
        global_score:      dip.conformity_score || null,
        changes_count:     changes.length,
        changes_snapshot:  changes,
        deliveries,
        generated_at:      generatedAt,
        public_token:      publicToken,
        status:            'pending',
      })
      .select()
      .single();

    if (saveErr) throw new Error(saveErr.message);

    const baseUrl = process.env.FRONTEND_URL || 'https://dippro.fr';

    res.status(201).json({
      certificate: saved,
      public_url:  `${baseUrl}/attestation/${publicToken}`,
      status:      'pending',
    });

    // Tâche de fond — Claude + PDF + Storage + notification franchisés
    (async () => {
      try {
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

        const fullRecord = {
          ...saved,
          certificate_title: cert.certificate_title,
          certificate_text:  cert.certificate_text,
          legal_summary:     cert.legal_summary,
          warnings:          cert.warnings || [],
          changes_snapshot:  changes,
          deliveries,
        };

        let pdfUrl = null;
        try {
          const pdfBuffer = await generateCertificatePDF(fullRecord, franchiseur);
          pdfUrl = await uploadPdfToStorage(pdfBuffer, saved.id, certificate_type, publicToken);
        } catch (pdfErr) {
          console.error('PDF gen/upload error:', pdfErr.message);
        }

        await supabaseAdmin
          .from('dip_certificates')
          .update({
            certificate_title: cert.certificate_title,
            certificate_text:  cert.certificate_text,
            legal_summary:     cert.legal_summary,
            warnings:          cert.warnings || [],
            generated_at:      cert.generated_at || generatedAt,
            pdf_url:           pdfUrl,
            status:            'done',
          })
          .eq('id', saved.id);

        // Notification automatique — uniquement pour les mises à jour
        if (certificate_type === 'MISE_A_JOUR' && changes.length > 0) {
          await notifyFranchisees({
            userId:      saved.user_id,
            certId:      saved.id,
            dipId:       dip_id,
            publicToken,
            cert,
            pdfUrl,
            changes,
          }).catch(e => console.error('Notification error:', e.message));
        }
      } catch (bgErr) {
        console.error('Background certificate error:', bgErr.message);
        await supabaseAdmin
          .from('dip_certificates')
          .update({ status: 'error' })
          .eq('id', saved.id)
          .catch(() => {});
      }
    })();

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
    .select('id, dip_id, certificate_type, certificate_title, legal_summary, warnings, compliance_level, global_score, changes_count, generated_at, public_token, pdf_url, status')
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

// ─── GET /api/certificates/:id — détail + status (authentifié) ───────────────
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

  if (data.pdf_url) return res.redirect(302, data.pdf_url);

  if (data.status === 'pending') {
    return res.status(202).json({ error: 'PDF en cours de génération, réessayez dans quelques secondes.' });
  }

  try {
    const franchiseur = await fetchFranchiseur(data.user_id, '');
    const pdfBuffer   = await generateCertificatePDF(data, franchiseur);

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

  if (data.pdf_url) return res.redirect(302, data.pdf_url);

  if (data.status === 'pending') {
    return res.status(202).json({ error: 'PDF en cours de génération, réessayez dans quelques secondes.' });
  }

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
