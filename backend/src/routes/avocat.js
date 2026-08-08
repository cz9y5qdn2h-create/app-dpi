const express = require('express');
const rateLimit = require('express-rate-limit');
const { getAppUrl } = require('../config/appUrl');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { createCertificate } = require('./certificates');
const errMsg = require('../config/errorMessage');
const router = express.Router();

// Provisionne un compte Supabase (si nécessaire) et envoie un email réel à
// chaque appel — sans limite dédiée, un compte franchiseur compromis ou un
// script pourrait spammer une adresse email ou générer des comptes en boucle
// via le seul rate-limit global (300 req/15min, partagé avec tout /api/*).
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop d'invitations envoyées. Réessayez dans une heure." },
});

const requireAvocat = async (req, res, next) => {
  const { data: profile } = await supabaseAdmin.from('users').select('role').eq('id', req.user.id).single();
  if (profile?.role !== 'avocat') return res.status(403).json({ error: 'Réservé aux avocats' });
  next();
};

// GET /api/avocat/dashboard
router.get('/dashboard', authMiddleware, requireAvocat, async (req, res) => {
  const { data: relations } = await supabaseAdmin
    .from('avocat_franchiseurs')
    .select('id, status, invited_at, accepted_at, franchiseur_id')
    .eq('avocat_id', req.user.id)
    .order('invited_at', { ascending: false });

  if (!relations?.length) return res.json({ franchiseurs: [], pending: [] });

  const franchiseurIds = relations.map(r => r.franchiseur_id);

  const [{ data: users }, { data: dips }] = await Promise.all([
    supabaseAdmin.from('users').select('id, company_name, email, siret').in('id', franchiseurIds),
    supabaseAdmin.from('dip_documents')
      .select('id, title, conformity_score, status, upload_date, user_id')
      .in('user_id', franchiseurIds).eq('status', 'actif')
      .order('upload_date', { ascending: false }),
  ]);

  const dipByUser = {};
  (dips || []).forEach(d => { if (!dipByUser[d.user_id]) dipByUser[d.user_id] = d; });

  const userById = {};
  (users || []).forEach(u => { userById[u.id] = u; });

  const enriched = relations.map(r => ({
    ...r,
    franchiseur: userById[r.franchiseur_id] || { id: r.franchiseur_id },
    latestDip: dipByUser[r.franchiseur_id] || null,
  }));

  res.json({
    franchiseurs: enriched.filter(r => r.status === 'active'),
    pending: enriched.filter(r => r.status === 'pending'),
  });
});

// ─── Lien d'invitation avocat (généré depuis Paramètres) ───────────────────
// Contrairement à /invite (email connu à l'avance), ce lien générique peut
// être partagé par n'importe quel canal — aucune adresse email requise.

// GET /api/avocat/invite-link — récupère le lien actuel du franchiseur (s'il existe)
router.get('/invite-link', authMiddleware, async (req, res) => {
  const { data } = await supabaseAdmin
    .from('users').select('avocat_invite_token').eq('id', req.user.id).single();

  const appUrl = getAppUrl();
  const token = data?.avocat_invite_token || null;
  res.json({ token, url: token ? `${appUrl}/avocat/rejoindre/${token}` : null });
});

// POST /api/avocat/invite-link — génère (ou régénère) le lien d'invitation
router.post('/invite-link', authMiddleware, async (req, res) => {
  const token = uuidv4();
  const { error } = await supabaseAdmin
    .from('users').update({ avocat_invite_token: token }).eq('id', req.user.id);
  if (error) return res.status(500).json({ error: errMsg(error) });

  const appUrl = getAppUrl();
  res.json({ token, url: `${appUrl}/avocat/rejoindre/${token}` });
});

// DELETE /api/avocat/invite-link — révoque le lien (l'ancien lien devient invalide)
router.delete('/invite-link', authMiddleware, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('users').update({ avocat_invite_token: null }).eq('id', req.user.id);
  if (error) return res.status(500).json({ error: errMsg(error) });
  res.json({ success: true });
});

// POST /api/avocat/join/:token — l'avocat connecté rejoint l'espace d'un franchiseur via son lien
router.post('/join/:token', authMiddleware, async (req, res) => {
  const { data: profile } = await supabaseAdmin.from('users').select('role, company_name').eq('id', req.user.id).single();
  if (profile?.role !== 'avocat') {
    return res.status(403).json({ error: 'Ce lien est réservé aux comptes avocat.' });
  }

  const { data: franchiseur } = await supabaseAdmin
    .from('users').select('id, company_name').eq('avocat_invite_token', req.params.token).maybeSingle();
  if (!franchiseur) return res.status(404).json({ error: 'Lien invalide ou expiré.' });

  const { data: existing } = await supabaseAdmin
    .from('avocat_franchiseurs').select('id, status')
    .eq('avocat_id', req.user.id).eq('franchiseur_id', franchiseur.id).maybeSingle();

  if (existing) {
    if (existing.status !== 'active') {
      await supabaseAdmin.from('avocat_franchiseurs')
        .update({ status: 'active', accepted_at: new Date().toISOString() }).eq('id', existing.id);
    }
  } else {
    await supabaseAdmin.from('avocat_franchiseurs').insert({
      avocat_id: req.user.id,
      franchiseur_id: franchiseur.id,
      status: 'active',
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    });
  }

  res.json({ success: true, franchiseur_id: franchiseur.id, franchiseur_name: franchiseur.company_name });
});

// GET /api/avocat/franchiseur/:franchiseurId/dip — DIP d'un franchiseur pour cet avocat
router.get('/franchiseur/:franchiseurId/dip', authMiddleware, requireAvocat, async (req, res) => {
  const { franchiseurId } = req.params;

  const { data: relation } = await supabaseAdmin
    .from('avocat_franchiseurs').select('status')
    .eq('avocat_id', req.user.id).eq('franchiseur_id', franchiseurId).maybeSingle();

  if (relation?.status !== 'active') return res.status(403).json({ error: 'Relation inactive ou inexistante' });

  const { data: dips } = await supabaseAdmin
    .from('dip_documents').select('*, dip_sections(*)')
    .eq('user_id', franchiseurId).eq('status', 'actif').limit(1);

  const dip = dips?.[0] || null;

  const { data: franchiseur } = await supabaseAdmin
    .from('users').select('id, company_name, email').eq('id', franchiseurId).single();

  let proposals = [];
  if (dip) {
    const { data } = await supabaseAdmin
      .from('dip_section_proposals').select('*')
      .eq('dip_id', dip.id).eq('proposed_by', req.user.id)
      .order('created_at', { ascending: false });
    proposals = data || [];
  }

  res.json({ dip, franchiseur, proposals });
});

// GET /api/avocat/franchiseur/:franchiseurId/contract — contrat d'un franchiseur pour cet avocat
router.get('/franchiseur/:franchiseurId/contract', authMiddleware, requireAvocat, async (req, res) => {
  const { franchiseurId } = req.params;

  const { data: relation } = await supabaseAdmin
    .from('avocat_franchiseurs').select('status')
    .eq('avocat_id', req.user.id).eq('franchiseur_id', franchiseurId).maybeSingle();

  if (relation?.status !== 'active') return res.status(403).json({ error: 'Relation inactive ou inexistante' });

  const { data: contracts } = await supabaseAdmin
    .from('franchise_contracts').select('*, contract_clauses(*)')
    .eq('user_id', franchiseurId).eq('status', 'actif').limit(1);

  const contract = contracts?.[0] || null;

  const { data: franchiseur } = await supabaseAdmin
    .from('users').select('id, company_name, email').eq('id', franchiseurId).single();

  let proposals = [];
  if (contract) {
    const { data } = await supabaseAdmin
      .from('contract_clause_proposals').select('*')
      .eq('contract_id', contract.id).eq('proposed_by', req.user.id)
      .order('created_at', { ascending: false });
    proposals = data || [];
  }

  res.json({ contract, franchiseur, proposals });
});

// POST /api/avocat/sections/:sectionId/propose — proposer une modification
router.post('/sections/:sectionId/propose', authMiddleware, requireAvocat, async (req, res) => {
  const { content, dip_id } = req.body;
  if (!content?.trim() || !dip_id) return res.status(400).json({ error: 'content et dip_id requis' });

  const { data: dip } = await supabaseAdmin
    .from('dip_documents').select('user_id').eq('id', dip_id).maybeSingle();
  if (!dip) return res.status(404).json({ error: 'DIP introuvable' });

  const { data: relation } = await supabaseAdmin
    .from('avocat_franchiseurs').select('status')
    .eq('avocat_id', req.user.id).eq('franchiseur_id', dip.user_id).maybeSingle();

  if (relation?.status !== 'active') return res.status(403).json({ error: 'Relation inactive' });

  const { data: section } = await supabaseAdmin
    .from('dip_sections').select('content').eq('id', req.params.sectionId).eq('dip_id', dip_id).maybeSingle();

  const { data: proposal, error } = await supabaseAdmin
    .from('dip_section_proposals')
    .insert({
      section_id: req.params.sectionId,
      dip_id,
      proposed_by: req.user.id,
      content_proposed: content.trim(),
      content_before: section?.content || null,
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ proposal });
});

// GET /api/avocat/dip/:dipId/proposals — propositions sur un DIP (franchiseur ou avocat)
router.get('/dip/:dipId/proposals', authMiddleware, async (req, res) => {
  const { data: dip } = await supabaseAdmin
    .from('dip_documents').select('user_id').eq('id', req.params.dipId).maybeSingle();
  if (!dip) return res.status(404).json({ error: 'DIP introuvable' });

  const isOwner = dip.user_id === req.user.id;
  if (!isOwner) {
    const { data: rel } = await supabaseAdmin
      .from('avocat_franchiseurs').select('status')
      .eq('avocat_id', req.user.id).eq('franchiseur_id', dip.user_id).maybeSingle();
    if (rel?.status !== 'active') return res.status(403).json({ error: 'Accès refusé' });
  }

  const { data: proposals } = await supabaseAdmin
    .from('dip_section_proposals')
    .select('*, proposer:users!proposed_by(id, company_name, email, role)')
    .eq('dip_id', req.params.dipId)
    .order('created_at', { ascending: false });

  res.json({ proposals: proposals || [] });
});

// PUT /api/avocat/proposals/:id/accept — franchiseur accepte la proposition
router.put('/proposals/:id/accept', authMiddleware, async (req, res) => {
  const { reviewer_comment } = req.body;

  const { data: proposal } = await supabaseAdmin
    .from('dip_section_proposals').select('*').eq('id', req.params.id).maybeSingle();
  if (!proposal) return res.status(404).json({ error: 'Proposition introuvable' });
  if (proposal.status !== 'pending') return res.status(400).json({ error: 'Proposition déjà traitée' });

  const { data: dip } = await supabaseAdmin
    .from('dip_documents').select('user_id').eq('id', proposal.dip_id).single();
  if (dip?.user_id !== req.user.id) return res.status(403).json({ error: 'Seul le franchiseur peut valider' });

  const { data: section } = await supabaseAdmin
    .from('dip_sections').select('section_title, section_number').eq('id', proposal.section_id).maybeSingle();

  const now = new Date().toISOString();

  await Promise.all([
    supabaseAdmin.from('dip_sections').update({
      content: proposal.content_proposed,
      last_edited_by: proposal.proposed_by,
      last_edited_at: now,
    }).eq('id', proposal.section_id),

    supabaseAdmin.from('dip_section_proposals').update({
      status: 'accepted',
      reviewer_id: req.user.id,
      reviewed_at: now,
      reviewer_comment: reviewer_comment || null,
    }).eq('id', req.params.id),
  ]);

  // Même correctif que pour l'édition directe (dip.js) : une proposition
  // d'avocat acceptée est une modification du DIP comme une autre, elle doit
  // générer une attestation et notifier les franchisés.
  createCertificate({
    userId: req.user.id,
    userEmail: req.user.email,
    dipId: proposal.dip_id,
    certificateType: 'MISE_A_JOUR',
    changes: [{
      id: proposal.section_id,
      type: 'proposition_avocat_acceptee',
      section: section?.section_title || 'Section',
      section_number: section?.section_number,
      ancien: proposal.content_before || '',
      nouveau: proposal.content_proposed || '',
      impact_legal: 'Moderate',
      recommandation_ia: 'Modification proposée par l\'avocat et validée par le franchiseur.',
    }],
  }).catch(e => console.error('Certificate auto-gen error (proposal accept):', e.message));

  res.json({ ok: true });
});

// PUT /api/avocat/proposals/:id/reject — franchiseur rejette la proposition
router.put('/proposals/:id/reject', authMiddleware, async (req, res) => {
  const { reviewer_comment } = req.body;

  const { data: proposal } = await supabaseAdmin
    .from('dip_section_proposals').select('dip_id, status').eq('id', req.params.id).maybeSingle();
  if (!proposal) return res.status(404).json({ error: 'Proposition introuvable' });
  if (proposal.status !== 'pending') return res.status(400).json({ error: 'Proposition déjà traitée' });

  const { data: dip } = await supabaseAdmin
    .from('dip_documents').select('user_id').eq('id', proposal.dip_id).single();
  if (dip?.user_id !== req.user.id) return res.status(403).json({ error: 'Seul le franchiseur peut rejeter' });

  await supabaseAdmin.from('dip_section_proposals').update({
    status: 'rejected',
    reviewer_id: req.user.id,
    reviewed_at: new Date().toISOString(),
    reviewer_comment: reviewer_comment || null,
  }).eq('id', req.params.id);

  res.json({ ok: true });
});

// POST /api/avocat/clauses/:clauseId/propose — proposer une modification de clause
router.post('/clauses/:clauseId/propose', authMiddleware, requireAvocat, async (req, res) => {
  const { content, contract_id } = req.body;
  if (!content?.trim() || !contract_id) return res.status(400).json({ error: 'content et contract_id requis' });

  const { data: contract } = await supabaseAdmin
    .from('franchise_contracts').select('user_id').eq('id', contract_id).maybeSingle();
  if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });

  const { data: relation } = await supabaseAdmin
    .from('avocat_franchiseurs').select('status')
    .eq('avocat_id', req.user.id).eq('franchiseur_id', contract.user_id).maybeSingle();

  if (relation?.status !== 'active') return res.status(403).json({ error: 'Relation inactive' });

  const { data: clause } = await supabaseAdmin
    .from('contract_clauses').select('content').eq('id', req.params.clauseId).eq('contract_id', contract_id).maybeSingle();

  const { data: proposal, error } = await supabaseAdmin
    .from('contract_clause_proposals')
    .insert({
      clause_id: req.params.clauseId,
      contract_id,
      proposed_by: req.user.id,
      content_proposed: content.trim(),
      content_before: clause?.content || null,
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ proposal });
});

// GET /api/avocat/contract/:contractId/proposals — propositions sur un contrat (franchiseur ou avocat)
router.get('/contract/:contractId/proposals', authMiddleware, async (req, res) => {
  const { data: contract } = await supabaseAdmin
    .from('franchise_contracts').select('user_id').eq('id', req.params.contractId).maybeSingle();
  if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });

  const isOwner = contract.user_id === req.user.id;
  if (!isOwner) {
    const { data: rel } = await supabaseAdmin
      .from('avocat_franchiseurs').select('status')
      .eq('avocat_id', req.user.id).eq('franchiseur_id', contract.user_id).maybeSingle();
    if (rel?.status !== 'active') return res.status(403).json({ error: 'Accès refusé' });
  }

  const { data: proposals } = await supabaseAdmin
    .from('contract_clause_proposals')
    .select('*, proposer:users!proposed_by(id, company_name, email, role)')
    .eq('contract_id', req.params.contractId)
    .order('created_at', { ascending: false });

  res.json({ proposals: proposals || [] });
});

// PUT /api/avocat/clause-proposals/:id/accept — franchiseur accepte la proposition
router.put('/clause-proposals/:id/accept', authMiddleware, async (req, res) => {
  const { reviewer_comment } = req.body;

  const { data: proposal } = await supabaseAdmin
    .from('contract_clause_proposals').select('*').eq('id', req.params.id).maybeSingle();
  if (!proposal) return res.status(404).json({ error: 'Proposition introuvable' });
  if (proposal.status !== 'pending') return res.status(400).json({ error: 'Proposition déjà traitée' });

  const { data: contract } = await supabaseAdmin
    .from('franchise_contracts').select('user_id').eq('id', proposal.contract_id).single();
  if (contract?.user_id !== req.user.id) return res.status(403).json({ error: 'Seul le franchiseur peut valider' });

  const now = new Date().toISOString();

  await Promise.all([
    supabaseAdmin.from('contract_clauses').update({
      content: proposal.content_proposed,
      last_edited_by: proposal.proposed_by,
      last_edited_at: now,
    }).eq('id', proposal.clause_id),

    supabaseAdmin.from('contract_clause_proposals').update({
      status: 'accepted',
      reviewer_id: req.user.id,
      reviewed_at: now,
      reviewer_comment: reviewer_comment || null,
    }).eq('id', req.params.id),
  ]);

  res.json({ ok: true });
});

// PUT /api/avocat/clause-proposals/:id/reject — franchiseur rejette la proposition
router.put('/clause-proposals/:id/reject', authMiddleware, async (req, res) => {
  const { reviewer_comment } = req.body;

  const { data: proposal } = await supabaseAdmin
    .from('contract_clause_proposals').select('contract_id, status').eq('id', req.params.id).maybeSingle();
  if (!proposal) return res.status(404).json({ error: 'Proposition introuvable' });
  if (proposal.status !== 'pending') return res.status(400).json({ error: 'Proposition déjà traitée' });

  const { data: contract } = await supabaseAdmin
    .from('franchise_contracts').select('user_id').eq('id', proposal.contract_id).single();
  if (contract?.user_id !== req.user.id) return res.status(403).json({ error: 'Seul le franchiseur peut rejeter' });

  await supabaseAdmin.from('contract_clause_proposals').update({
    status: 'rejected',
    reviewer_id: req.user.id,
    reviewed_at: new Date().toISOString(),
    reviewer_comment: reviewer_comment || null,
  }).eq('id', req.params.id);

  res.json({ ok: true });
});

// POST /api/avocat/invite — le franchiseur invite son avocat par email
// Provisionne et lie tout de suite, sans étape intermédiaire pour l'avocat :
// c'est le franchiseur qui déclenche la création du compte (sans mot de
// passe — accès uniquement par le lien reçu) et la liaison à son propre
// dossier, jamais un tiers (admin) qui décide après coup qui est l'avocat
// de qui. L'avocat n'a rien à faire d'autre que cliquer le lien reçu.
router.post('/invite', authMiddleware, inviteLimiter, async (req, res) => {
  const { lawyer_email } = req.body;
  if (!lawyer_email?.trim()) return res.status(400).json({ error: 'Email requis' });

  const email = lawyer_email.trim().toLowerCase();
  const appUrl = getAppUrl();

  const { data: franchiseur } = await supabaseAdmin
    .from('users').select('id, company_name').eq('id', req.user.id).single();

  await supabaseAdmin.from('users').update({ lawyer_email: email }).eq('id', req.user.id);

  const { data: existing } = await supabaseAdmin
    .from('users').select('id, role, avocat_access_token').eq('email', email).maybeSingle();
  if (existing && existing.role !== 'avocat') {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email sous un autre rôle.' });
  }

  let avocatId = existing?.id;
  if (!avocatId) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, email_confirm: true,
    });
    if (authError) return res.status(400).json({ error: authError.message });
    avocatId = authData.user.id;
  }

  const accessToken = existing?.avocat_access_token || uuidv4();
  const upsertPayload = {
    id: avocatId, email, role: 'avocat', trial_expires_at: null, avocat_access_token: accessToken,
  };
  if (!existing) {
    upsertPayload.company_name = email.split('@')[0];
    upsertPayload.created_at = new Date().toISOString();
  }
  const { error: profileError } = await supabaseAdmin
    .from('users').upsert(upsertPayload, { onConflict: 'id' });
  if (profileError) return res.status(500).json({ error: profileError.message });

  const now = new Date().toISOString();
  const { data: relExisting } = await supabaseAdmin
    .from('avocat_franchiseurs').select('id, status')
    .eq('avocat_id', avocatId).eq('franchiseur_id', req.user.id).maybeSingle();
  if (relExisting) {
    if (relExisting.status !== 'active') {
      await supabaseAdmin.from('avocat_franchiseurs')
        .update({ status: 'active', accepted_at: now }).eq('id', relExisting.id);
    }
  } else {
    await supabaseAdmin.from('avocat_franchiseurs').insert({
      avocat_id: avocatId, franchiseur_id: req.user.id, status: 'active', invited_at: now, accepted_at: now,
    });
  }

  const joinUrl = `${appUrl}/api/auth/avocat-login/${accessToken}`;

  const brevoKey = process.env.BREVO_API_KEY;
  const companyName = franchiseur?.company_name || 'Un franchiseur';

  if (brevoKey) {
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'DIPpro', email: 'noreply@dippro.business' },
          to: [{ email }],
          subject: `${companyName} vous invite à accéder à son DIP sur DIPpro`,
          htmlContent: `
<div style="font-family:'DM Sans',Arial,sans-serif;max-width:540px;margin:auto;color:#1A1826">
  <div style="background:linear-gradient(135deg,#C8A96E,#A8893E);border-radius:12px 12px 0 0;padding:24px 32px">
    <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#fff;font-weight:600">DIPpro</p>
    <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.75);font-family:monospace">by Iralink Agency</p>
  </div>
  <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #f0ece4;border-top:none">
    <p style="margin:0 0 16px;font-size:15px">Bonjour,</p>
    <p style="margin:0 0 16px;font-size:15px"><strong>${companyName}</strong> vous invite à consulter et annoter son Document d'Information Précontractuelle (DIP) directement sur <strong>DIPpro</strong>.</p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">En cliquant sur le lien ci-dessous, vous pourrez :</p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#475569;font-size:14px;line-height:2">
      <li>Consulter toutes les sections du DIP de votre client</li>
      <li>Proposer des modifications directement dans l'interface</li>
      <li>Suivre l'historique des versions et validations</li>
      <li>Accompagner plusieurs réseaux de franchise depuis un seul espace</li>
    </ul>
    <a href="${joinUrl}" style="display:inline-block;background:linear-gradient(135deg,#C8A96E,#A8893E);color:#1A1826;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Accéder à l'espace de ${companyName} →</a>
    <p style="margin:24px 0 0;font-size:12px;color:#94A3B8">Aucun mot de passe à créer — ce lien vous connecte directement à ce dossier. Conservez-le, il reste valable à chaque utilisation.</p>
    <hr style="border:none;border-top:1px solid #f0ece4;margin:24px 0">
    <p style="margin:0;font-size:11px;color:#94A3B8">DIPpro — Gestion des DIP franchise · Loi Doubin · <a href="${appUrl}/cgu" style="color:#C8A96E">CGU</a></p>
  </div>
</div>`,
        }),
      });
    } catch {
      // Non-bloquant : l'invite est sauvegardée même si l'email échoue
    }
  }

  res.json({ success: true, message: 'Invitation envoyée', url: joinUrl });
});

// ─── Annexes de section DIP / clause de contrat ───────────────────────────
// Bucket privé 'dip-annexes' (créé par la migration 037) — chemin toujours
// préfixé par l'id du franchiseur PROPRIÉTAIRE (jamais l'auteur de
// l'upload), pour que la policy storage reste simple à vérifier. Upload
// direct client → Supabase Storage (même pattern que DocumentsPage.jsx),
// ces routes ne font qu'enregistrer les métadonnées après coup.
const ANNEX_BUCKET = 'dip-annexes';

// Retourne l'id du franchiseur propriétaire si userId y a accès (propriétaire
// du DIP, ou avocat avec relation active vers ce franchiseur), sinon null.
async function resolveDipOwner(dipId, userId) {
  const { data: dip } = await supabaseAdmin.from('dip_documents').select('user_id').eq('id', dipId).maybeSingle();
  if (!dip) return null;
  if (dip.user_id === userId) return dip.user_id;
  const { data: rel } = await supabaseAdmin
    .from('avocat_franchiseurs').select('status')
    .eq('avocat_id', userId).eq('franchiseur_id', dip.user_id).maybeSingle();
  return rel?.status === 'active' ? dip.user_id : null;
}

async function resolveContractOwner(contractId, userId) {
  const { data: contract } = await supabaseAdmin.from('franchise_contracts').select('user_id').eq('id', contractId).maybeSingle();
  if (!contract) return null;
  if (contract.user_id === userId) return contract.user_id;
  const { data: rel } = await supabaseAdmin
    .from('avocat_franchiseurs').select('status')
    .eq('avocat_id', userId).eq('franchiseur_id', contract.user_id).maybeSingle();
  return rel?.status === 'active' ? contract.user_id : null;
}

// POST /api/avocat/sections/:sectionId/annexes
router.post('/sections/:sectionId/annexes', authMiddleware, async (req, res) => {
  const { dip_id, file_name, storage_path, size_bytes } = req.body;
  if (!dip_id || !file_name || !storage_path) {
    return res.status(400).json({ error: 'dip_id, file_name et storage_path requis' });
  }
  const ownerId = await resolveDipOwner(dip_id, req.user.id);
  if (!ownerId) return res.status(403).json({ error: 'Accès refusé' });
  if (!storage_path.startsWith(`${ownerId}/`)) return res.status(403).json({ error: 'Chemin de stockage invalide' });

  const { data: signedUrlData } = await supabaseAdmin.storage.from(ANNEX_BUCKET).createSignedUrl(storage_path, 3600);
  const { data: inserted, error } = await supabaseAdmin
    .from('dip_section_annexes')
    .insert({
      section_id: req.params.sectionId,
      dip_id,
      uploaded_by: req.user.id,
      file_name: file_name.substring(0, 255),
      storage_path,
      file_url: signedUrlData?.signedUrl || null,
      size_bytes: size_bytes || null,
    })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ annexe: inserted });
});

// GET /api/avocat/sections/:sectionId/annexes
router.get('/sections/:sectionId/annexes', authMiddleware, async (req, res) => {
  const { data: section } = await supabaseAdmin.from('dip_sections').select('dip_id').eq('id', req.params.sectionId).maybeSingle();
  if (!section) return res.status(404).json({ error: 'Section introuvable' });
  const ownerId = await resolveDipOwner(section.dip_id, req.user.id);
  if (!ownerId) return res.status(403).json({ error: 'Accès refusé' });

  const { data, error } = await supabaseAdmin
    .from('dip_section_annexes').select('*').eq('section_id', req.params.sectionId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ annexes: data || [] });
});

// POST /api/avocat/clauses/:clauseId/annexes
router.post('/clauses/:clauseId/annexes', authMiddleware, async (req, res) => {
  const { contract_id, file_name, storage_path, size_bytes } = req.body;
  if (!contract_id || !file_name || !storage_path) {
    return res.status(400).json({ error: 'contract_id, file_name et storage_path requis' });
  }
  const ownerId = await resolveContractOwner(contract_id, req.user.id);
  if (!ownerId) return res.status(403).json({ error: 'Accès refusé' });
  if (!storage_path.startsWith(`${ownerId}/`)) return res.status(403).json({ error: 'Chemin de stockage invalide' });

  const { data: signedUrlData } = await supabaseAdmin.storage.from(ANNEX_BUCKET).createSignedUrl(storage_path, 3600);
  const { data: inserted, error } = await supabaseAdmin
    .from('dip_section_annexes')
    .insert({
      clause_id: req.params.clauseId,
      contract_id,
      uploaded_by: req.user.id,
      file_name: file_name.substring(0, 255),
      storage_path,
      file_url: signedUrlData?.signedUrl || null,
      size_bytes: size_bytes || null,
    })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ annexe: inserted });
});

// GET /api/avocat/clauses/:clauseId/annexes
router.get('/clauses/:clauseId/annexes', authMiddleware, async (req, res) => {
  const { data: clause } = await supabaseAdmin.from('contract_clauses').select('contract_id').eq('id', req.params.clauseId).maybeSingle();
  if (!clause) return res.status(404).json({ error: 'Clause introuvable' });
  const ownerId = await resolveContractOwner(clause.contract_id, req.user.id);
  if (!ownerId) return res.status(403).json({ error: 'Accès refusé' });

  const { data, error } = await supabaseAdmin
    .from('dip_section_annexes').select('*').eq('clause_id', req.params.clauseId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ annexes: data || [] });
});

// DELETE /api/avocat/annexes/:id
router.delete('/annexes/:id', authMiddleware, async (req, res) => {
  const { data: annexe, error: fetchErr } = await supabaseAdmin
    .from('dip_section_annexes').select('*').eq('id', req.params.id).maybeSingle();
  if (fetchErr || !annexe) return res.status(404).json({ error: 'Annexe introuvable' });

  const ownerId = annexe.dip_id
    ? await resolveDipOwner(annexe.dip_id, req.user.id)
    : await resolveContractOwner(annexe.contract_id, req.user.id);
  if (!ownerId && annexe.uploaded_by !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });

  await supabaseAdmin.storage.from(ANNEX_BUCKET).remove([annexe.storage_path]);
  const { error } = await supabaseAdmin.from('dip_section_annexes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
