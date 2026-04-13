const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const { data: profile } = await supabaseAdmin
    .from('users').select('*').eq('id', req.user.id).single();
  const { data: sources } = await supabaseAdmin
    .from('data_sources').select('*').eq('user_id', req.user.id);
  res.json({ profile, data_sources: sources || [] });
});

router.put('/profile', authMiddleware, async (req, res) => {
  const { company_name, phone, address, siret, siren, renewal_alert_date } = req.body;
  const updates = { company_name, phone, address };
  if (siret !== undefined) updates.siret = siret;
  if (siren !== undefined) updates.siren = siren;
  if (renewal_alert_date !== undefined) updates.renewal_alert_date = renewal_alert_date || null;
  const { data, error } = await supabaseAdmin
    .from('users').update(updates).eq('id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ profile: data });
});

router.post('/sources', authMiddleware, async (req, res) => {
  const { type, config } = req.body;
  const { data, error } = await supabaseAdmin
    .from('data_sources').insert({ user_id: req.user.id, type, config: config || {} })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ source: data });
});

router.delete('/sources/:id', authMiddleware, async (req, res) => {
  await supabaseAdmin.from('data_sources')
    .delete().eq('id', req.params.id).eq('user_id', req.user.id);
  res.json({ message: 'Source supprimée' });
});

module.exports = router;
