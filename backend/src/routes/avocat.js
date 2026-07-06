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

module.exports = router;
