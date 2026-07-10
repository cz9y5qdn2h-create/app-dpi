const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

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

// POST /api/avocat/invite — franchiseur invite son avocat
router.post('/invite', authMiddleware, async (req, res) => {
  const { lawyer_email } = req.body;
  if (!lawyer_email?.trim()) return res.status(400).json({ error: 'Email requis' });

  const email = lawyer_email.trim().toLowerCase();

  const { data: franchiseur } = await supabaseAdmin
    .from('users').select('id, company_name').eq('id', req.user.id).single();

  // Sauvegarder l'email avocat dans le profil franchiseur
  await supabaseAdmin.from('users').update({ lawyer_email: email }).eq('id', req.user.id);

  // Si l'avocat est déjà inscrit, créer la relation automatiquement
  const { data: existingAvocat } = await supabaseAdmin
    .from('users').select('id, role').eq('email', email).maybeSingle();

  if (existingAvocat?.role === 'avocat') {
    const { data: existing } = await supabaseAdmin
      .from('avocat_franchiseurs').select('id')
      .eq('avocat_id', existingAvocat.id).eq('franchiseur_id', req.user.id).maybeSingle();

    if (!existing) {
      await supabaseAdmin.from('avocat_franchiseurs').insert({
        avocat_id: existingAvocat.id,
        franchiseur_id: req.user.id,
        status: 'active',
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      });
    }
  }

  // Envoyer l'email d'invitation via la clé Brevo système
  const brevoKey = process.env.BREVO_API_KEY;
  const appUrl = process.env.APP_URL || 'https://app-dpi.vercel.app';
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
    <p style="margin:0 0 16px;font-size:14px;color:#475569">En créant un compte avocat, vous pourrez :</p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#475569;font-size:14px;line-height:2">
      <li>Consulter toutes les sections du DIP de votre client</li>
      <li>Proposer des modifications directement dans l'interface</li>
      <li>Suivre l'historique des versions et validations</li>
      <li>Accompagner plusieurs réseaux de franchise depuis un seul espace</li>
    </ul>
    <a href="${appUrl}/register?role=avocat" style="display:inline-block;background:linear-gradient(135deg,#C8A96E,#A8893E);color:#1A1826;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Créer mon compte avocat →</a>
    <p style="margin:24px 0 0;font-size:12px;color:#94A3B8">Après inscription, recherchez <strong>${companyName}</strong> dans votre tableau de bord pour accéder à son DIP.</p>
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

  res.json({ success: true, message: 'Invitation envoyée' });
});

module.exports = router;
